import Parser from 'rss-parser';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { normalizeBlogUrl } from '../../shared/blog.js';

// 1. 실제 브라우저인 것처럼 속여 보안 차단을 회피합니다.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const parser = new Parser({
  headers: {
    'User-Agent': BROWSER_UA,
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

export type BlogSyncFailure = {
  githubId: string;
  blog: string;
  rssUrl?: string;
  step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup';
  error: string;
};

export type BlogSyncProgress = {
  total: number;
  processed: number;
  synced: number;
  percent: number;
  phase: string;
};

type RssCheckResult = {
  status: 'available' | 'unavailable' | 'error';
  rssUrl?: string;
  error?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isFeedPath(pathname: string): boolean {
  return /\/(feed|rss|rss\.xml|feed\.xml|atom\.xml|index\.xml)$/i.test(pathname);
}

// XML 파싱 실패를 유발하는 제어 문자 제거 추가
export function sanitizeXml(xml: string): string {
  return xml
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
}

async function resolveBlogUrl(blogUrl: string): Promise<string | null> {
  const normalized = normalizeBlogUrl(blogUrl);
  if (!normalized) return null;

  const url = new URL(normalized);
  if (!['bit.ly', 't.co', 'tinyurl.com'].includes(url.hostname)) return normalized;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA },
      signal: controller.signal,
    });
    return normalizeBlogUrl(response.url) ?? normalized;
  } catch {
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveRSSUrlsForBlog(blogUrl: string): string[] {
  const normalizedBlogUrl = normalizeBlogUrl(blogUrl);
  if (!normalizedBlogUrl) return [];

  const url = new URL(normalizedBlogUrl);
  if (isFeedPath(url.pathname)) return [normalizedBlogUrl];

  if (url.hostname === 'velog.io') {
    const match = url.pathname.match(/^\/@[^/]+/);
    if (match) return [`https://v2.velog.io/rss${match[0]}`];
  }

  if (url.hostname.endsWith('.tistory.com')) return [`${normalizedBlogUrl}/rss`];

  if (url.hostname === 'brunch.co.kr') {
    const match = url.pathname.match(/^\/@[^/]+/);
    if (match) return [`https://brunch.co.kr/rss${match[0]}`];
  }

  if (url.hostname === 'medium.com' || url.hostname.endsWith('.medium.com')) {
    return [`https://medium.com/feed${url.pathname}`];
  }

  const base = normalizedBlogUrl;
  return [
    ...new Set([
      `${base}/rss`, // 티스토리/워드프레스 범용
      `${base}/feed`, // 벨로그/미디엄 범용
      `${base}/feed.xml`,
      `${base}/rss.xml`,
      `${base}/atom.xml`,
      `${base}/index.xml`,
    ]),
  ];
}

async function fetchFeedText(rssUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(rssUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    if (response.status === 404) throw new Error('404');
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRSSItems(blogUrl: string): Promise<{
  items: { title?: string; link?: string; pubDate?: string }[];
  failure?: Pick<BlogSyncFailure, 'blog' | 'rssUrl' | 'step' | 'error'>;
  rssCheck: RssCheckResult;
}> {
  const resolvedBlogUrl = await resolveBlogUrl(blogUrl);
  const candidates = resolvedBlogUrl ? resolveRSSUrlsForBlog(resolvedBlogUrl) : [];
  let lastError: { rssUrl?: string; error: string } | null = null;

  for (const rssUrl of candidates) {
    try {
      const xml = await fetchFeedText(rssUrl);
      const feed = await parser.parseString(sanitizeXml(xml));
      return { items: feed.items, rssCheck: { status: 'available', rssUrl } };
    } catch (error) {
      const message = errorMessage(error);
      lastError = { rssUrl, error: message };

      // 404나 네트워크 실패 시 다음 후보 주소로 계속 시도합니다.
      continue;
    }
  }

  return {
    items: [],
    rssCheck: {
      status: lastError ? 'error' : 'unavailable',
      ...(lastError?.rssUrl && { rssUrl: lastError.rssUrl }),
      ...(lastError?.error && { error: lastError.error }),
    },
    ...(lastError && {
      failure: {
        blog: blogUrl,
        step: 'rss_fetch',
        error: lastError.error,
        ...(lastError.rssUrl && { rssUrl: lastError.rssUrl }),
      },
    }),
  };
}

export async function probeRss(blogUrl: string): Promise<RssCheckResult> {
  const { rssCheck } = await fetchRSSItems(blogUrl);
  return rssCheck;
}

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  return {
    syncBlogs: async (
      workspaceId: number,
      onProgress?: (progress: BlogSyncProgress) => void,
    ): Promise<{ synced: number; deleted: number; failures: BlogSyncFailure[] }> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 1. 닉네임 중복에 상관없이 GitHub ID가 포함된 멤버 리스트를 가져옵니다.
      const members = await memberRepo.findWithFilters(workspaceId, { hasBlog: true });

      let synced = 0;
      let processed = 0;
      const failures: BlogSyncFailure[] = [];
      const total = members.length;

      const emitProgress = (phase: string, forcePercent?: number) => {
        const percent = forcePercent ?? (total === 0 ? 100 : Math.min(100, Math.round((processed / total) * 100)));
        onProgress?.({
          total,
          processed,
          synced,
          percent,
          phase,
        });
      };

      emitProgress(total === 0 ? '수집 대상 없음' : 'RSS 수집 준비 중', total === 0 ? 100 : 0);

      for (const member of members) {
        // 2. 각 멤버의 고유 정보를 바탕으로 RSS 수집
        const result = await fetchRSSItems(member.blog!);

        const latestDate = result.items
          .map((item) => (item.pubDate ? new Date(item.pubDate) : null))
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        // 3. 닉네임이 같아도 고유한 member.id를 사용하여 DB를 업데이트하므로 데이터가 섞이지 않습니다.
        await memberRepo.patch(member.id, {
          rssStatus: result.rssCheck.status,
          rssUrl: result.rssCheck.rssUrl ?? null,
          rssCheckedAt: new Date(),
          rssError: result.rssCheck.error ?? null,
          ...(latestDate && { lastPostedAt: latestDate }),
        });

        if (result.failure) {
          // 에러 발생 시 로그에 명확히 githubId를 남깁니다.
          failures.push({ githubId: member.githubId, ...result.failure });
          processed += 1;
          emitProgress(`${member.githubId} RSS 확인 완료`);
          continue;
        }

        for (const item of result.items) {
          if (!item.link || !item.title || !item.pubDate) continue;
          const publishedAt = new Date(item.pubDate);

          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;

          try {
            // 4. 고유 식별자(member.id)를 사용하여 소유권을 명확히 기록합니다.
            await blogPostRepo.upsert({
              where: { url: item.link },
              create: {
                url: item.link,
                title: item.title,
                publishedAt,
                memberId: member.id,
              },
              update: {
                title: item.title,
                publishedAt,
                // 소유권(memberId)은 처음 생성한 사람으로 고정하거나
                // 필요 시 memberId: member.id를 update에 추가하여 덮어쓸 수 있습니다.
              },
            });
            synced++;
          } catch (error) {
            failures.push({
              githubId: member.githubId,
              blog: member.blog!,
              rssUrl: item.link,
              step: 'blog_post_upsert',
              error: errorMessage(error),
            });
          }
        }

        processed += 1;
        emitProgress(`${member.githubId} RSS 확인 완료`);
      }

      let deleted = 0;
      emitProgress('오래된 글 정리 중', total === 0 ? 100 : Math.max(Math.round((processed / total) * 100), 95));
      try {
        const cleanupResult = await blogPostRepo.deleteBefore(thirtyDaysAgo);
        deleted = cleanupResult.count;
      } catch (error) {
        throw new HttpError(500, `blog sync cleanup failed: ${errorMessage(error)}`);
      }

      emitProgress('완료', 100);

      return { synced, deleted, failures };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
