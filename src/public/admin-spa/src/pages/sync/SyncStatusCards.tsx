import type { AdminStatus, GithubStatus, TecoTalkAdminItem } from '../../lib/types.js';
import { Panel } from '../../components/ui/Section.js';
import { formatDate } from './sync-format.js';
import { countTecoTalkMatches } from './tecotalk-counts.js';

interface Props {
  status: AdminStatus;
  githubStatus: GithubStatus | undefined;
  tecoTalks: TecoTalkAdminItem[];
}

export function SyncStatusCards({ status, githubStatus, tecoTalks }: Props) {
  const repoCount = status.activeRepoCount ?? status.repoCount;
  const counts = countTecoTalkMatches(tecoTalks);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Panel>
        <p className="text-xs text-base-500">멤버 수</p>
        <p className="text-xl font-semibold text-base-900">{status.memberCount}</p>
      </Panel>
      <Panel>
        <p className="text-xs text-base-500">활성 레포</p>
        <p className="text-xl font-semibold text-base-900">{repoCount ?? '—'}</p>
      </Panel>
      <Panel>
        <p className="text-xs text-base-500">마지막 싱크</p>
        <p className="text-sm font-medium text-base-700">{formatDate(status.lastSyncAt)}</p>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-base-500">GitHub API</p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              !githubStatus
                ? 'bg-base-100 text-base-500'
                : githubStatus.ok
                  ? githubStatus.remaining < 100
                    ? 'bg-caution-100 text-caution-700'
                    : 'bg-success-100 text-success-700'
                  : 'bg-danger-100 text-danger-700'
            }`}
          >
            {!githubStatus ? '확인 중' : githubStatus.ok ? '정상' : '오류'}
          </span>
        </div>
        <p className="text-xl font-semibold text-base-900">
          {githubStatus?.ok ? `${githubStatus.remaining}/${githubStatus.limit}` : '—'}
        </p>
        {githubStatus?.resetAt && <p className="text-[10px] text-base-400">reset {formatDate(githubStatus.resetAt)}</p>}
      </Panel>
      <Panel>
        <p className="text-xs text-base-500">테코톡 매칭</p>
        <p className="text-xl font-semibold text-base-900">
          {counts.matched}/{tecoTalks.length}
        </p>
        <p className="text-[10px] text-base-400">
          ambiguous {counts.ambiguous} · unmatched {counts.unmatched}
        </p>
      </Panel>
    </div>
  );
}
