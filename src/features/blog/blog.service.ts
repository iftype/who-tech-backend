import Parser from 'rss-parser';
import prisma from '../../db/prisma.js';

const parser = new Parser();

function resolveRSSUrl(blogUrl: string): string[] {
  const url = new URL(blogUrl);

  // Velog: https://velog.io/@username → https://v2.velog.io/rss/@username
  if (url.hostname === 'velog.io') {
    return [`https://v2.velog.io/rss${url.pathname}`];
  }

  // Tistory: https://xxx.tistory.com → /rss
  if (url.hostname.endsWith('.tistory.com')) {
    return [`${blogUrl.replace(/\/$/, '')}/rss`];
  }

  // GitHub Pages, 기타: 공통 suffix 시도
  const base = blogUrl.replace(/\/$/, '');
  return [`${base}/feed.xml`, `${base}/rss.xml`, `${base}/feed`, `${base}/rss`];
}

async function fetchRSSItems(blogUrl: string): Promise<{ title?: string; link?: string; pubDate?: string }[]> {
  const candidates = resolveRSSUrl(blogUrl);

  for (const rssUrl of candidates) {
    try {
      const feed = await parser.parseURL(rssUrl);
      return feed.items;
    } catch {
      continue;
    }
  }

  return [];
}

export async function syncBlogs(workspaceId: number): Promise<{ synced: number; deleted: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const members = await prisma.member.findMany({
    where: { workspaceId, blog: { not: null } },
    select: { id: true, blog: true },
  });

  let synced = 0;

  for (const member of members) {
    const items = await fetchRSSItems(member.blog!);

    for (const item of items) {
      if (!item.link || !item.title || !item.pubDate) continue;

      const publishedAt = new Date(item.pubDate);
      if (isNaN(publishedAt.getTime()) || publishedAt < sevenDaysAgo) continue;

      await prisma.blogPost.upsert({
        where: { url: item.link },
        create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
        update: {},
      });

      synced++;
    }
  }

  const { count: deleted } = await prisma.blogPost.deleteMany({
    where: { publishedAt: { lt: sevenDaysAgo } },
  });

  return { synced, deleted };
}
