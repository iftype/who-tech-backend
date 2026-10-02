import type { MemberRepository, MemberDetailWithRelations } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import { decodeHtml } from '../../shared/html.js';
import { fetchRSSItems, errorMessage } from './blog.rss.js';
import type { BlogSyncFailure } from './blog.rss.js';

export type { BlogSyncFailure, BlogSyncProgress, RssCheckResult } from './blog.rss.js';
export { sanitizeXml, resolveRSSUrlsForBlog, probeRss } from './blog.rss.js';

const RETENTION_DAYS = 90;
const MAX_POSTS_PER_MEMBER = 100;
const MAX_POSTS_PER_DAY = 3;
const TEAM_BLOG_GITHUB_ID = '__team_rilog__';
const TEAM_BLOG_URL = 'https://www.rilog.kr/@official';
export const DEFAULT_TEAM_BLOG_RSS_URL = 'https://www.rilog.kr/rss.xml';
const TEAM_BLOG_AVATAR_URL = '/rilog-avatar.png';

function teamBlogEnabled(): boolean {
  return (
    process.env['TEAM_BLOG_RSS_ENABLED'] !== 'false' &&
    (Boolean(process.env['TEAM_BLOG_RSS_URL']) || process.env['NODE_ENV'] === 'production')
  );
}

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  async function getOrCreateTeamBlogMember(workspaceId: number): Promise<MemberDetailWithRelations> {
    const existing = await memberRepo.findByGithubId(TEAM_BLOG_GITHUB_ID, workspaceId);
    if (existing) {
      await memberRepo.patch(existing.id, {
        nickname: 'Rilog',
        manualNickname: 'Rilog',
        avatarUrl: TEAM_BLOG_AVATAR_URL,
        blog: TEAM_BLOG_URL,
        isTeamBlog: true,
      });
      return {
        ...existing,
        nickname: 'Rilog',
        manualNickname: 'Rilog',
        avatarUrl: TEAM_BLOG_AVATAR_URL,
        blog: TEAM_BLOG_URL,
        isTeamBlog: true,
      };
    }
    return memberRepo.create({
      githubId: TEAM_BLOG_GITHUB_ID,
      nickname: 'Rilog',
      manualNickname: 'Rilog',
      avatarUrl: TEAM_BLOG_AVATAR_URL,
      blog: TEAM_BLOG_URL,
      rssStatus: 'unknown',
      isTeamBlog: true,
      workspaceId,
    });
  }

  async function syncTeamBlog(workspaceId: number) {
    const rssUrl = process.env['TEAM_BLOG_RSS_URL'] ?? DEFAULT_TEAM_BLOG_RSS_URL;
    if (!teamBlogEnabled()) return { synced: 0, deleted: 0, failures: [] as BlogSyncFailure[] };
    const member = await getOrCreateTeamBlogMember(workspaceId);
    return doSyncMemberBlog({ ...member, blog: rssUrl }, workspaceId);
  }

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
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
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

    const feedUrls = result.items.map((item) => item.link).filter((url): url is string => !!url);
    const feedDeleteResult = await blogPostRepo.deleteByMemberNotInUrls(member.id, feedUrls, cutoff);
    deleted += feedDeleteResult.count;

    for (const item of result.items) {
      if (!item.link || !item.title || !item.pubDate) continue;
      const publishedAt = new Date(item.pubDate);
      if (isNaN(publishedAt.getTime()) || publishedAt < cutoff) continue;

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

    try {
      const excessResult = await blogPostRepo.deleteExcessByMember(member.id, MAX_POSTS_PER_MEMBER);
      deleted += excessResult.count;
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
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
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

      const teamResult = await syncTeamBlog(workspaceId);
      synced += teamResult.synced;
      deleted += teamResult.deleted;
      failures.push(...teamResult.failures);

      emitProgress('오래된 글 정리 중', total === 0 ? 100 : Math.max(Math.round((processed / total) * 100), 95));
      try {
        const cleanupResult = await blogPostRepo.deleteBefore(cutoff);
        deleted += cleanupResult.count;
      } catch (error) {
        throw new HttpError(500, `blog sync cleanup failed: ${errorMessage(error)}`);
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
