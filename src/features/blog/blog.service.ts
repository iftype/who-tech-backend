import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { fetchRSSItems, errorMessage } from './blog.rss.js';

export type { BlogSyncFailure, BlogSyncProgress, RssCheckResult } from './blog.rss.js';
export { sanitizeXml, resolveRSSUrlsForBlog, probeRss } from './blog.rss.js';

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  return {
    syncBlogs: async (
      workspaceId: number,
      onProgress?: (progress: {
        total: number;
        processed: number;
        synced: number;
        percent: number;
        phase: string;
      }) => void,
    ): Promise<{
      synced: number;
      deleted: number;
      failures: {
        githubId: string;
        blog: string;
        rssUrl?: string;
        step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup';
        error: string;
      }[];
    }> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const members = await memberRepo.findWithFilters(workspaceId, { hasBlog: true });

      let synced = 0;
      let deleted = 0;
      let processed = 0;
      const failures: {
        githubId: string;
        blog: string;
        rssUrl?: string;
        step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup';
        error: string;
      }[] = [];
      const total = members.length;

      const emitProgress = (phase: string, forcePercent?: number) => {
        const percent = forcePercent ?? (total === 0 ? 100 : Math.min(100, Math.round((processed / total) * 100)));
        onProgress?.({ total, processed, synced, percent, phase });
      };

      emitProgress(total === 0 ? '수집 대상 없음' : 'RSS 수집 준비 중', total === 0 ? 100 : 0);

      for (const member of members) {
        const result = await fetchRSSItems(member.blog!);

        const latestDate = result.items
          .map((item) => (item.pubDate ? new Date(item.pubDate) : null))
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        await memberRepo.patch(member.id, {
          rssStatus: result.rssCheck.status,
          rssUrl: result.rssCheck.rssUrl ?? null,
          rssCheckedAt: new Date(),
          rssError: result.rssCheck.error ?? null,
          ...(latestDate && { lastPostedAt: latestDate }),
        });

        if (result.failure) {
          failures.push({ githubId: member.githubId, ...result.failure });
          processed += 1;
          emitProgress(`${member.githubId} RSS 확인 완료`);
          continue;
        }

        const previousRssUrl = member.rssUrl;
        const currentRssUrl = result.rssCheck.rssUrl;
        if (previousRssUrl && currentRssUrl && previousRssUrl !== currentRssUrl) {
          await blogPostRepo.deleteByMember(member.id);
        }

        const feedUrls = result.items.map((item) => item.link).filter((url): url is string => !!url);
        const feedDeleteResult = await blogPostRepo.deleteByMemberNotInUrls(member.id, feedUrls, thirtyDaysAgo);
        deleted += feedDeleteResult.count;

        for (const item of result.items) {
          if (!item.link || !item.title || !item.pubDate) continue;
          const publishedAt = new Date(item.pubDate);
          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;

          try {
            await blogPostRepo.upsert({
              where: { url: item.link },
              create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
              update: { title: item.title, publishedAt },
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

      emitProgress('오래된 글 정리 중', total === 0 ? 100 : Math.max(Math.round((processed / total) * 100), 95));
      try {
        const cleanupResult = await blogPostRepo.deleteBefore(thirtyDaysAgo);
        deleted += cleanupResult.count;
      } catch (error) {
        throw new HttpError(500, `blog sync cleanup failed: ${errorMessage(error)}`);
      }

      emitProgress('완료', 100);
      return { synced, deleted, failures };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
