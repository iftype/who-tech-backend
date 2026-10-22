import type { Member } from '../../lib/types.js';
import { ROLE_LABELS } from './member-labels.js';

// 멤버 표의 읽기 전용 셀 내용 (편집 버튼은 MemberRow가 감싼다)

/** 참여 기수 알약: "8기(코치)" 묶음, 없으면 — */
export function CohortPills({ cohorts }: { cohorts: Member['cohorts'] }) {
  return cohorts.length === 0 ? (
    <span className="text-base-300 text-2xs">—</span>
  ) : (
    <div className="flex flex-wrap gap-0.5">
      {cohorts.map((c) => (
        <span
          key={c.cohort}
          className="text-2xs bg-primary-50 text-primary-700 border border-primary-200 rounded px-1 py-0 whitespace-nowrap"
        >
          {c.cohort}기
          {c.roles.length > 0 && (
            <span className="text-primary-400 ml-0.5">({c.roles.map((r) => ROLE_LABELS[r] ?? r).join(',')})</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** RSS 상태 아이콘: 정상 ✅ · 오류 ❌ · 미설정 — */
export function RssStatusIcon({ status }: { status: Member['rssStatus'] }) {
  return status === 'ok' ? (
    <span className="text-2xs text-success-600" title="RSS 정상">
      ✅
    </span>
  ) : status === 'error' ? (
    <span className="text-2xs text-danger-500" title="RSS 오류">
      ❌
    </span>
  ) : (
    <span className="text-2xs text-base-300" title="RSS 미설정">
      —
    </span>
  );
}
