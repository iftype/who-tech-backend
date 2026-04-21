import type { MemberCohort } from '../../lib/types.js';

const ROLE_LABELS: Record<string, string> = {
  crew: '크루',
  coach: '코치',
  reviewer: '리뷰어',
};

export default function CohortRoleBadges({ cohorts }: { cohorts: MemberCohort[] }) {
  if (!cohorts.length) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {cohorts.map((c) =>
        c.roles.map((r) => (
          <span
            key={`${c.cohort}-${r}`}
            className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5"
          >
            {c.cohort}기 {ROLE_LABELS[r] ?? r}
          </span>
        ))
      )}
    </div>
  );
}
