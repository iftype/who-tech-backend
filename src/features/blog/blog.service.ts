import Parser from 'rss-parser';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { normalizeBlogUrl } from '../../shared/blog.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

function resolveRSSUrl(blogUrl: string): string[] {
  const normalizedBlogUrl = normalizeBlogUrl(blogUrl);
  if (!normalizedBlogUrl) return [];

  const url = new URL(normalizedBlogUrl);

  if (url.hostname === 'velog.io') return [`https://v2.velog.io/rss${url.pathname}`];
  if (url.hostname.endsWith('.tistory.com')) return [`${normalizedBlogUrl}/rss`];

  const base = normalizedBlogUrl;
  return [`${base}/feed.xml`, `${base}/rss.xml`, `${base}/feed`, `${base}/rss`];
}

type BlogSyncFailure = {
  githubId: string;
  blog: string;
  rssUrl?: string;
  step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup' | 'latest_refresh';
  error: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function fetchRSSItems(blogUrl: string): Promise<{
  items: { title?: string; link?: string; pubDate?: string }[];
  failure?: Pick<BlogSyncFailure, 'blog' | 'rssUrl' | 'step' | 'error'>;
}> {
  const candidates = resolveRSSUrl(blogUrl);

  for (const rssUrl of candidates) {
    try {
      return { items: (await parser.parseURL(rssUrl)).items };
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes('404')) {
        continue;
      }

      return {
        items: [],
        failure: {
          blog: blogUrl,
          step: 'rss_fetch',
          error: message,
          ...(rssUrl ? { rssUrl } : {}),
        },
      };
    }
  }

  if (candidates.length > 0) {
    return {
      items: [],
      failure: {
        blog: blogUrl,
        step: 'rss_fetch',
        error: 'no valid rss feed found',
        ...(candidates[candidates.length - 1] ? { rssUrl: candidates[candidates.length - 1] } : {}),
      },
    };
  }

  return {
    items: [],
    failure: {
      blog: blogUrl,
      step: 'rss_fetch',
      error: 'invalid blog url',
    },
  };
}

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  return {
    syncBlogs: async (
      workspaceId: number,
    ): Promise<{ synced: number; deleted: number; failures: BlogSyncFailure[] }> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const members = await memberRepo.findMany({
        where: { workspaceId, blog: { not: null } },
        select: { id: true, githubId: true, blog: true },
      });

      let synced = 0;
      const failures: BlogSyncFailure[] = [];

      for (const member of members) {
        const result = await fetchRSSItems(member.blog!);
        if (result.failure) {
          failures.push({ githubId: member.githubId, ...result.failure });
          continue;
        }

        for (const item of result.items) {
          if (!item.link || !item.title || !item.pubDate) continue;
          const publishedAt = new Date(item.pubDate);
          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;

          try {
            await blogPostRepo.upsert({
              where: { url: item.link },
              create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
              update: {},
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
      }

      let deleted = 0;

      try {
        ({ count: deleted } = await blogPostRepo.deleteBefore(thirtyDaysAgo));
      } catch (error) {
        throw new HttpError(500, `blog sync cleanup failed: ${errorMessage(error)}`);
      }

      try {
        await blogPostRepo.refreshLatest(sevenDaysAgo);
      } catch (error) {
        throw new HttpError(500, `blog latest refresh failed: ${errorMessage(error)}`);
      }

      return { synced, deleted, failures };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
