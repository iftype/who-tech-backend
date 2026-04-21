import Parser from 'rss-parser';
import { normalizeBlogUrl } from '../../shared/blog.js';

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

export type RssCheckResult = {
  status: 'available' | 'unavailable' | 'error';
  rssUrl?: string;
  error?: string;
};

// 실제 브라우저인 것처럼 속여 보안 차단을 회피합니다.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const parser = new Parser({
  headers: {
    'User-Agent': BROWSER_UA,
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isFeedPath(pathname: string): boolean {
  return /\/(feed|rss|rss\.xml|feed\.xml|atom\.xml|index\.xml)$/i.test(pathname);
}

// XML 파싱 실패를 유발하는 제어 문자 제거
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
      `${base}/rss`,
      `${base}/feed`,
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

export async function fetchRSSItems(blogUrl: string): Promise<{
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
      lastError = { rssUrl, error: errorMessage(error) };
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
