import type { AdminStatus, GithubStatus, TecoTalkAdminItem } from '../../lib/types.js';
import { StatCard, StatGrid, statBadgeVariants } from '../../components/ui/StatCard.js';
import { formatDate } from './sync-format.js';
import { countTecoTalkMatches } from './tecotalk-counts.js';

interface Props {
  status: AdminStatus;
  githubStatus: GithubStatus | undefined;
  tecoTalks: TecoTalkAdminItem[];
}

function githubBadge(githubStatus: GithubStatus | undefined) {
  if (!githubStatus) return <span className={statBadgeVariants()}>확인 중</span>;
  if (!githubStatus.ok) return <span className={statBadgeVariants({ tone: 'danger' })}>오류</span>;
  const tone = githubStatus.remaining < 100 ? 'caution' : 'success';
  return <span className={statBadgeVariants({ tone })}>정상</span>;
}

export function SyncStatusCards({ status, githubStatus, tecoTalks }: Props) {
  const repoCount = status.activeRepoCount ?? status.repoCount;
  const counts = countTecoTalkMatches(tecoTalks);

  return (
    <StatGrid columns={5}>
      <StatCard label="멤버 수" value={status.memberCount} />
      <StatCard label="활성 레포" value={repoCount ?? '—'} />
      <StatCard label="마지막 싱크" value={formatDate(status.lastSyncAt)} size="md" />
      <StatCard
        label="GitHub API"
        aside={githubBadge(githubStatus)}
        value={githubStatus?.ok ? `${githubStatus.remaining}/${githubStatus.limit}` : '—'}
        hint={githubStatus?.resetAt ? `reset ${formatDate(githubStatus.resetAt)}` : undefined}
      />
      <StatCard
        label="테코톡 매칭"
        value={`${counts.matched}/${tecoTalks.length}`}
        hint={`ambiguous ${counts.ambiguous} · unmatched ${counts.unmatched}`}
      />
    </StatGrid>
  );
}
