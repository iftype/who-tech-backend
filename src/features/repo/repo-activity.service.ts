import type { Octokit } from '@octokit/rest';
import { classifyMissionRepo, type DiscoveredRepo, type OrgRepo } from './repo-discovery.service.js';

// 최근 PR 활동으로 미션 레포를 자동 분류한다 (#236).
// 조직 전체 PR을 검색 API로 찾고 → 처음 보는 레포는 미분류(candidate)로 추가, active 레포는 활동 중에만 continuous.
// 레벨·탭·기수 연결과 active 승격은 사람이 한다

/** 이 기간 안에 PR이 열리거나 갱신(머지 포함)된 레포를 "활동 중"으로 본다 */
export const ACTIVITY_WINDOW_DAYS = 14;

export type RepoActivity = { name: string; lastActivityAt: string; prCount: number };

type KnownRepo = { id: number; name: string; status: string; syncMode: string };

export type ActivityPlan = {
  /** 처음 보는 레포 — 상세를 가져와 분류한 뒤 추가 */
  toCreate: RepoActivity[];
  /** active 레포에 활동이 있어 continuous로 */
  toContinuous: KnownRepo[];
  /** active·continuous인데 기간 안에 활동이 없어 once로 */
  toOnce: KnownRepo[];
};

/** 순수 판정: 지금 레포 목록과 최근 활동으로 바꿀 것을 고른다 */
export function planRepoActivity(known: KnownRepo[], activity: RepoActivity[]): ActivityPlan {
  const byName = new Map(known.map((repo) => [repo.name, repo]));
  const activeNames = new Set(activity.map((a) => a.name));
  return {
    toCreate: activity.filter((a) => !byName.has(a.name)),
    toContinuous: known.filter((r) => r.status === 'active' && r.syncMode !== 'continuous' && activeNames.has(r.name)),
    toOnce: known.filter((r) => r.status === 'active' && r.syncMode === 'continuous' && !activeNames.has(r.name)),
  };
}

/**
 * 처음 보는 레포의 분류. 키워드로는 신호가 없어도(no mission signal) 최근 PR 활동이 곧 신호라 미분류(candidate)로 넣는다.
 * docs·wiki 같은 제외 키워드는 그대로 excluded
 */
export function classifyActiveRepo(repo: OrgRepo, activity: RepoActivity): DiscoveredRepo {
  const classified = classifyMissionRepo(repo);
  const reason = `최근 PR 활동 ${activity.prCount}건 (${activity.lastActivityAt.slice(0, 10)})`;
  if (classified.candidateReason === 'no mission signal') {
    return {
      ...classified,
      status: 'candidate',
      tabCategory: classified.track ? 'base' : 'common',
      candidateReason: reason,
    };
  }
  return { ...classified, candidateReason: `${classified.candidateReason} · ${reason}` };
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * 조직의 최근 PR을 레포별로 묶는다. 검색 API는 질의당 1000건까지라 하루씩 나눠 묻는다(14번, 분당 30회 한도 안)
 */
export async function fetchRecentRepoActivity(
  octokit: Octokit,
  org: string,
  now: Date = new Date(),
  days: number = ACTIVITY_WINDOW_DAYS,
): Promise<RepoActivity[]> {
  const repos = new Map<string, RepoActivity>();
  for (let offset = 0; offset < days; offset++) {
    const date = day(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000));
    for (let page = 1; page <= 10; page++) {
      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: `org:${org} is:pr updated:${date}`,
        per_page: 100,
        page,
      });
      for (const item of data.items) {
        const name = item.repository_url.split('/').pop();
        if (!name) continue;
        const current = repos.get(name);
        repos.set(name, {
          name,
          prCount: (current?.prCount ?? 0) + 1,
          lastActivityAt:
            current && current.lastActivityAt > item.updated_at ? current.lastActivityAt : item.updated_at,
        });
      }
      if (data.items.length < 100) break;
    }
  }
  return [...repos.values()].sort((a, b) => a.name.localeCompare(b.name));
}
