import type { MemberRepository, MemberWithRelations } from '../../db/repositories/member.repository.js';
import type { TecoTalkRepository } from '../../db/repositories/tecotalk.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { detectCohort } from '../sync/github.service.js';
import { normalizeNickname, parseNicknameStats, resolveDisplayNickname } from '../../shared/nickname.js';
import { HttpError } from '../../shared/http.js';
import { fetchPlaylistVideos, type YouTubeVideo } from './youtube.js';
import { extractSpeakerZone, nicknameInZone } from './tecotalk.parser.js';

export type VideoFetcher = (
  playlistId: string,
  apiKey: string,
  opts?: { maxVideos?: number },
) => Promise<YouTubeVideo[]>;

// 우아한테크코스 테코톡 재생목록 (https://youtube.com/playlist?list=...)
const DEFAULT_PLAYLIST_ID = 'PLgXGHBqgT2TvpJ_p9L_yZKPifgdBOzdVH';
// 증분(주간) 모드에서 확인할 최신 영상 개수 (재생목록 앞쪽 = 최신 업로드)
const INCREMENTAL_LIMIT = 50;

export type TecoTalkSyncResult = {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
};

/** 멤버가 가진 모든 닉네임 후보(정규화)를 모은다: manualNickname / nicknameStats / nickname */
function memberNicknameSet(member: MemberWithRelations): Set<string> {
  const set = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = normalizeNickname(value);
    if (normalized) set.add(normalized);
  };

  add(member.manualNickname);
  add(member.nickname);
  for (const stat of parseNicknameStats(member.nicknameStats)) add(stat.nickname);
  // resolveDisplayNickname 으로 노출되는 대표 닉네임도 포함
  add(resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname));

  return set;
}

export function createTecoTalkService(deps: {
  tecoTalkRepo: TecoTalkRepository;
  memberRepo: MemberRepository;
  workspaceService: WorkspaceService;
  fetchVideos?: VideoFetcher;
}) {
  const { tecoTalkRepo, memberRepo, workspaceService } = deps;
  const fetchVideos = deps.fetchVideos ?? fetchPlaylistVideos;

  return {
    // full=true: 전체 백필(초기 1회). 기본: 증분(최신 INCREMENTAL_LIMIT개만 — 주간 cron용)
    syncTecoTalks: async (opts?: { full?: boolean }): Promise<TecoTalkSyncResult> => {
      const apiKey = process.env['YOUTUBE_API_KEY'];
      if (!apiKey) throw new HttpError(500, 'YOUTUBE_API_KEY is not configured');

      const playlistId = process.env['TECOTALK_PLAYLIST_ID'] ?? DEFAULT_PLAYLIST_ID;
      const { id: workspaceId, cohortRules } = await workspaceService.getSyncContext();

      const videos = await fetchVideos(playlistId, apiKey, opts?.full ? undefined : { maxVideos: INCREMENTAL_LIMIT });

      // 기수별 멤버 캐시 (동일 sync 내 재조회 방지). null 기수는 'all' 키.
      const candidateCache = new Map<string, MemberWithRelations[]>();
      const loadCandidates = async (cohort: number | null): Promise<MemberWithRelations[]> => {
        const key = cohort === null ? 'all' : String(cohort);
        const cached = candidateCache.get(key);
        if (cached) return cached;
        const members = await memberRepo.findWithFiltersLight(workspaceId, cohort === null ? undefined : { cohort });
        candidateCache.set(key, members);
        return members;
      };

      const result: TecoTalkSyncResult = { total: videos.length, matched: 0, ambiguous: 0, unmatched: 0 };

      for (const video of videos) {
        // 업로드 연도 → 기수 매핑 (cohortRules)
        const cohort = detectCohort(video.uploadedAt, cohortRules);
        // 발표자 구역(닉네임 나열 부분)에서 우리 닉네임을 검색해 매칭 (2인 공동 발표 지원)
        const speakerZone = extractSpeakerZone(video.title);
        const candidates = await loadCandidates(cohort);

        // 매칭된 닉네임 → 그 닉네임을 가진 멤버 id 목록 (기수 내 닉네임은 유일하므로 보통 1명)
        const matchedByNickname = new Map<string, number[]>();
        for (const member of candidates) {
          for (const nickname of memberNicknameSet(member)) {
            if (nicknameInZone(speakerZone, nickname)) {
              const ids = matchedByNickname.get(nickname) ?? [];
              if (!ids.includes(member.id)) ids.push(member.id);
              matchedByNickname.set(nickname, ids);
              break; // 멤버당 한 번 매칭이면 충분
            }
          }
        }

        const speakerIds: number[] = [];
        let hasAmbiguous = false;
        for (const ids of matchedByNickname.values()) {
          if (ids.length === 1) speakerIds.push(ids[0]!);
          else hasAmbiguous = true; // 동일 닉네임 보유 멤버가 여럿(기수 불명 등) → 특정 불가
        }

        const matchStatus: 'matched' | 'ambiguous' | 'unmatched' =
          speakerIds.length > 0 ? 'matched' : hasAmbiguous ? 'ambiguous' : 'unmatched';

        const { id } = await tecoTalkRepo.upsertByVideoId({
          videoId: video.videoId,
          title: video.title,
          url: video.url,
          thumbnailUrl: video.thumbnailUrl,
          speakerNickname: speakerZone.length > 0 ? speakerZone : null,
          uploadedAt: video.uploadedAt,
          viewCount: video.viewCount,
          cohort,
          matchStatus,
          workspaceId,
        });
        await tecoTalkRepo.setSpeakers(id, speakerIds);

        result[matchStatus] += 1;
      }

      return result;
    },

    listTecoTalks: async (filters?: { cohort?: number; matchStatus?: string }) => {
      const { id: workspaceId } = await workspaceService.getSyncContext();
      return tecoTalkRepo.findByWorkspace(workspaceId, {
        ...(filters?.cohort !== undefined ? { cohort: filters.cohort } : {}),
        ...(filters?.matchStatus ? { matchStatus: filters.matchStatus } : {}),
      });
    },
  };
}

export type TecoTalkService = ReturnType<typeof createTecoTalkService>;
