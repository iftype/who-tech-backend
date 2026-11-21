import type { MemberRepository, MemberDetailWithRelations } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import { decodeHtml } from '../../shared/html.js';
import { fetchRSSItems, errorMessage, isNonPostPageUrl } from '../../infra/rss/rss.js';

export type { BlogSyncFailure, BlogSyncProgress, RssCheckResult } from '../../infra/rss/rss.js';
export { sanitizeXml, resolveRSSUrlsForBlog, probeRss, isNonPostPageUrl } from '../../infra/rss/rss.js';

// 기간이 지난 글은 지우지 않는다. 이 기간 안의 글만 "RSS에서 빠졌으면 삭제" 대상이다
const FEED_REMOVAL_WINDOW_DAYS = 90;
// 하루에 남길 글 수. 한 사람이 글을 몰아 올려 피드를 덮지 않게 하는 장치다. 멤버당 총 개수 한도(예전 100개)는 두지 않는다
const MAX_POSTS_PER_DAY = 3;

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  async function doSyncMemberBlog(
    member: MemberDetailWithRelations,
    workspaceId: number,
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
  }> {
    const cutoff = new Date(Date.now() - FEED_REMOVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const cohorts = buildCohortList(member.memberCohorts);
    const primaryCohort = cohorts[0]?.cohort ?? null;
    const inferredTrack = computeDominantTrack(member.submissions);
    const memberTrack = member.track ?? inferredTrack ?? null;

    let synced = 0;
    let deleted = 0;
    const failures: {
      githubId: string;
      blog: string;
      rssUrl?: string;
      step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup';
      error: string;
    }[] = [];

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
      return { synced, deleted, failures };
    }

    const previousRssUrl = member.rssUrl;
    const currentRssUrl = result.rssCheck.rssUrl;
    if (previousRssUrl && currentRssUrl && previousRssUrl !== currentRssUrl) {
      await blogPostRepo.deleteByMember(member.id);
    }

    // 최근 90일 안의 글 중 피드에서 사라진 것은 지운다(작성자가 지운 글). 단 글이 하나도 없는 피드는
    // 블로그 쪽 일시 오류일 가능성이 커서 지우지 않는다 (예전에는 빈 피드 한 번에 최근 90일 글이 모두 사라졌다)
    const feedUrls = result.items.map((item) => item.link).filter((url): url is string => !!url);
    if (feedUrls.length > 0) {
      const feedDeleteResult = await blogPostRepo.deleteByMemberNotInUrls(member.id, feedUrls, cutoff);
      deleted += feedDeleteResult.count;
    }

    for (const item of result.items) {
      if (!item.link || !item.title || !item.pubDate) continue;
      if (isNonPostPageUrl(item.link)) continue;
      const publishedAt = new Date(item.pubDate);
      // RSS에 남아 있는 글은 오래됐어도 수집해 보존한다
      if (isNaN(publishedAt.getTime())) continue;

      try {
        const decodedTitle = decodeHtml(item.title);
        await blogPostRepo.upsert({
          where: { url: item.link },
          create: {
            url: item.link,
            title: decodedTitle,
            publishedAt,
            memberId: member.id,
            cohort: primaryCohort,
            track: memberTrack,
            workspaceId,
          },
          update: {
            title: decodedTitle,
            publishedAt,
            cohort: primaryCohort,
            track: memberTrack,
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

    try {
      const perDayResult = await blogPostRepo.deleteExcessPerDayByMember(member.id, MAX_POSTS_PER_DAY);
      deleted += perDayResult.count;
    } catch (error) {
      failures.push({
        githubId: member.githubId,
        blog: member.blog!,
        step: 'cleanup',
        error: errorMessage(error),
      });
    }

    return { synced, deleted, failures };
  }

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
        const result = await doSyncMemberBlog(member, workspaceId);
        synced += result.synced;
        deleted += result.deleted;
        failures.push(...result.failures);
        processed += 1;
        emitProgress(`${member.githubId} RSS 확인 완료`);
      }

      emitProgress('완료', 100);
      return { synced, deleted, failures };
    },

    syncMemberBlog: async (memberId: number, workspaceId: number) => {
      const member = await memberRepo.findByIdWithRelations(memberId);
      if (!member) throw new HttpError(404, 'member not found');
      return doSyncMemberBlog(member, workspaceId);
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
