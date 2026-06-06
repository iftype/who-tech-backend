import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { createTecoTalkService, type VideoFetcher } from '../../features/tecotalk/tecotalk.service.js';
import type { TecoTalkRepository } from '../../db/repositories/tecotalk.repository.js';
import type { MemberRepository, MemberWithRelations } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../../features/workspace/workspace.service.js';

function member(id: number, nickname: string): MemberWithRelations {
  return { id, nickname, manualNickname: null, nicknameStats: null } as unknown as MemberWithRelations;
}

function makeVideo(title: string, year: number) {
  return {
    videoId: `vid-${title}`,
    title,
    url: 'https://youtube.com/watch?v=x',
    thumbnailUrl: null,
    uploadedAt: new Date(`${year}-05-01T00:00:00Z`),
    viewCount: 100,
  };
}

function setup(candidates: MemberWithRelations[], videos: ReturnType<typeof makeVideo>[]) {
  const upsertByVideoId = jest.fn(() => Promise.resolve({ id: 42 }));
  const setSpeakers = jest.fn(() => Promise.resolve());
  const tecoTalkRepo = { upsertByVideoId, setSpeakers } as unknown as TecoTalkRepository;

  const memberRepo = {
    findWithFiltersLight: jest.fn(() => Promise.resolve(candidates)),
  } as unknown as MemberRepository;

  const workspaceService = {
    getSyncContext: jest.fn(() =>
      Promise.resolve({ id: 1, githubOrg: 'woowacourse', cohortRules: [{ year: 2024, cohort: 6 }] }),
    ),
  } as unknown as WorkspaceService;

  const fetchVideos: VideoFetcher = () => Promise.resolve(videos);
  const service = createTecoTalkService({ tecoTalkRepo, memberRepo, workspaceService, fetchVideos });
  return { service, upsertByVideoId, setSpeakers };
}

describe('createTecoTalkService.syncTecoTalks', () => {
  beforeEach(() => {
    process.env['YOUTUBE_API_KEY'] = 'test-key';
  });
  afterEach(() => {
    delete process.env['YOUTUBE_API_KEY'];
  });

  it('소유격 닉네임이 일치하면 matched로 발표자를 연결한다', async () => {
    const { service, upsertByVideoId, setSpeakers } = setup(
      [member(10, '클라우디'), member(11, '피트')],
      [makeVideo('[10분 테코톡] 클라우디의 세션과 JWT', 2024)],
    );

    const result = await service.syncTecoTalks();

    expect(result).toEqual({ total: 1, matched: 1, ambiguous: 0, unmatched: 0 });
    expect(upsertByVideoId).toHaveBeenCalledWith(
      expect.objectContaining({ matchStatus: 'matched', cohort: 6, viewCount: 100, speakerNickname: '클라우디' }),
    );
    expect(setSpeakers).toHaveBeenCalledWith(42, [10]);
  });

  it('쉼표로 나열된 2인 공동 발표자를 모두 연결한다', async () => {
    const { service, setSpeakers } = setup(
      [member(10, '프리'), member(20, '말론'), member(30, '피트')],
      [makeVideo('[10분 테코톡] 프리, 말론의 B-Tree 인덱스', 2024)],
    );

    const result = await service.syncTecoTalks();

    expect(result.matched).toBe(1);
    const [, ids] = setSpeakers.mock.calls[0] as [number, number[]];
    expect([...ids].sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it('일치하는 멤버가 없으면 unmatched로 저장하고 발표자를 비운다', async () => {
    const { service, upsertByVideoId, setSpeakers } = setup(
      [member(10, '클라우디')],
      [makeVideo('[10분 테코톡] 없는닉의 토픽', 2024)],
    );

    const result = await service.syncTecoTalks();

    expect(result.unmatched).toBe(1);
    expect(upsertByVideoId).toHaveBeenCalledWith(expect.objectContaining({ matchStatus: 'unmatched' }));
    expect(setSpeakers).toHaveBeenCalledWith(42, []);
  });

  it('YOUTUBE_API_KEY가 없으면 에러를 던진다', async () => {
    delete process.env['YOUTUBE_API_KEY'];
    const { service } = setup([], []);
    await expect(service.syncTecoTalks()).rejects.toThrow('YOUTUBE_API_KEY');
  });
});
