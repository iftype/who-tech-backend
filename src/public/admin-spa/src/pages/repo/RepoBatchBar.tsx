import { TRACK_OPTIONS } from './repo-options.js';
import type { RepoSelection } from './useRepoSelection.js';

// 선택한 레포가 있을 때만 보이는 트랙 일괄 변경 막대
export function RepoBatchBar({ selection }: { selection: RepoSelection }) {
  return (
    <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2.5">
      <span className="text-sm font-medium text-primary-700">{selection.selectedRepoIds.size}개 선택됨</span>
      <select
        value={selection.batchTrackValue}
        onChange={(e) => selection.setBatchTrackValue(e.target.value)}
        className="text-sm border border-primary-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
      >
        {TRACK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={selection.applyBatchTrack}
        disabled={selection.isApplying}
        className="text-sm px-3 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
      >
        {selection.isApplying ? '변경 중...' : '일괄 변경'}
      </button>
      <button
        onClick={selection.clear}
        className="text-sm px-3 py-1 rounded-lg border border-base-300 text-base-600 hover:bg-base-50"
      >
        선택 해제
      </button>
    </div>
  );
}
