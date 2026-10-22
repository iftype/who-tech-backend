import type { Member } from '../../lib/types.js';
import type { MemberActions } from './useMemberActions.js';

// 멤버 행 끝의 작업 버튼 넷: 프로필 새로고침(쿨다운 표시) · PR 재수집 · 기수 재계산 · 삭제
export function MemberRowActions({ member: m, actions }: { member: Member; actions: MemberActions }) {
  const { cooldowns, refreshing, resyncing, recalculating } = actions;
  return (
    <div className="flex gap-0.5">
      <button
        onClick={() => void actions.refreshProfile(m)}
        disabled={refreshing === m.id || !!(cooldowns[m.id] && cooldowns[m.id] > 0)}
        className="text-2xs text-base-500 hover:text-primary-600 disabled:opacity-40 px-0.5 min-w-[20px]"
        title={cooldowns[m.id] ? `${cooldowns[m.id]}초 후 가능` : '프로필 새로고침'}
        aria-label="프로필 새로고침"
      >
        {refreshing === m.id ? '⟳' : cooldowns[m.id] ? `${cooldowns[m.id]}s` : '↺'}
      </button>
      <button
        onClick={() => void actions.resyncSubmissions(m)}
        disabled={resyncing === m.id}
        className="text-2xs text-base-500 hover:text-success-600 disabled:opacity-40 px-0.5"
        title="PR 재수집"
        aria-label="PR 재수집"
      >
        {resyncing === m.id ? '⟳' : '↻'}
      </button>
      <button
        onClick={() => void actions.recalculateCohorts(m)}
        disabled={recalculating === m.id}
        className="text-2xs text-base-500 hover:text-warning-600 disabled:opacity-40 px-0.5"
        title="기수 재계산"
        aria-label="기수 재계산"
      >
        {recalculating === m.id ? '⟳' : '⚡'}
      </button>
      <button
        onClick={() => void actions.deleteMember(m)}
        className="text-2xs text-base-400 hover:text-danger-500 disabled:opacity-40 px-0.5"
        title="삭제"
        aria-label="삭제"
      >
        ✕
      </button>
    </div>
  );
}
