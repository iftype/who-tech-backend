import type { MemberRepository, MemberDetailWithRelations } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { TeamBlogRepository } from '../../db/repositories/team-blog.repository.js';
import { HttpError } from '../../shared/http.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import { decodeHtml } from '../../shared/html.js';
import { fetchRSSItems, errorMessage, isNonPostPageUrl } from '../../infra/rss/rss.js';
import type { BlogSyncFailure } from '../../infra/rss/rss.js';

export type { BlogSyncFailure, BlogSyncProgress, RssCheckResult } from '../../infra/rss/rss.js';
export { sanitizeXml, resolveRSSUrlsForBlog, probeRss, isNonPostPageUrl } from '../../infra/rss/rss.js';

// 기간이 지난 글은 지우지 않는다. 이 기간 안의 글만 "RSS에서 빠졌으면 삭제" 대상이다
const FEED_REMOVAL_WINDOW_DAYS = 90;
const MAX_POSTS_PER_MEMBER = 100;
const MAX_POSTS_PER_DAY = 3;
export const DEFAULT_TEAM_BLOG_RSS_URL = 'https://www.rilog.kr/rss.xml';

export function createBlogService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  teamBlogRepo?: TeamBlogRepository;
}) {
  const { memberRepo, blogPostRepo, teamBlogRepo } = deps;

  async function ensureDefaultTeamBlog(workspaceId: number) {
    const repository = teamBlogRepo;
    if (!repository) throw new Error('team blog repository is not configured');
    const existingTeamBlog = await repository.findBySlug(workspaceId, 'rilog');
    if (existingTeamBlog) return existingTeamBlog;

    const existing = await memberRepo.findByGithubId('__team_rilog__', workspaceId);
    const member = existing
      ? await memberRepo.patch(existing.id, {
          nickname: 'Rilog',
          manualNickname: 'Rilog',
          avatarUrl: '/rilog-avatar.png',
          blog: 'https://www.rilog.kr/feeds',
          isTeamBlog: true,
        })
      : await memberRepo.create({
          githubId: '__team_rilog__',
          nickname: 'Rilog',
          manualNickname: 'Rilog',
          avatarUrl: '/rilog-avatar.png',
          blog: 'https://www.rilog.kr/feeds',
          rssStatus: 'unknown',
          isTeamBlog: true,
          workspaceId,
        });

    return repository.create({
      slug: 'rilog',
      name: 'Rilog',
      blogUrl: 'https://www.rilog.kr/feeds',
      rssUrl: DEFAULT_TEAM_BLOG_RSS_URL,
      avatarUrl: '/rilog-avatar.png',
      memberId: member.id,
      workspaceId,
    });
  }

  async function ensureTeamBlogs(workspaceId: number) {
    const repository = teamBlogRepo;
    if (!repository) return [];
    const existing = await repository.findAll(workspaceId);
    return existing.length > 0 ? existing : [await ensureDefaultTeamBlog(workspaceId)];
  }

  async function syncTeamBlogs(workspaceId: number) {
    const repository = teamBlogRepo;
    if (!repository) return { synced: 0, deleted: 0, failures: [] as BlogSyncFailure[] };
    const teamBlogs = await ensureTeamBlogs(workspaceId);
    let synced = 0;
    let deleted = 0;
    const failures: BlogSyncFailure[] = [];

    for (const teamBlog of teamBlogs.filter((blog) => blog.enabled)) {
      const member = await memberRepo.findByIdWithRelations(teamBlog.memberId);
      if (!member) continue;
      const result = await doSyncMemberBlog({ ...member, blog: teamBlog.rssUrl }, workspaceId);
      synced += result.synced;
      deleted += result.deleted;
      failures.push(...result.failures);
      await repository.update(teamBlog.id, {
        rssStatus: result.failures.some((failure) => failure.step === 'rss_fetch') ? 'error' : 'available',
        rssCheckedAt: new Date(),
        rssError: result.failures.find((failure) => failure.step === 'rss_fetch')?.error ?? null,
      });
    }

    return { synced, deleted, failures };
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
            ...(member.isTeamBlog ? { authorName: item.authorName ?? null } : {}),
            publishedAt,
            memberId: member.id,
            cohort: primaryCohort,
            track: memberTrack,
            workspaceId,
          },
          update: {
            title: decodedTitle,
            ...(member.isTeamBlog ? { authorName: item.authorName ?? null } : {}),
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
    ensureTeamBlogs: async (workspaceId: number) => {
      return ensureTeamBlogs(workspaceId);
    },
    syncTeamBlogs: async (workspaceId: number) => syncTeamBlogs(workspaceId),
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

      // 팀 피드는 멤버 블로그가 많아도 먼저 처리해, 전체 팀 글이 싱크 지연의 영향을 받지 않게 한다.
      const teamResult = await syncTeamBlogs(workspaceId);
      synced += teamResult.synced;
      deleted += teamResult.deleted;
      failures.push(...teamResult.failures);

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
