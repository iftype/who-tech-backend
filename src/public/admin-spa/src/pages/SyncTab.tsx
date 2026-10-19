import { SyncScheduleStatus } from './sync/SyncScheduleStatus.js';
import { RecentJobsTable } from './sync/RecentJobsTable.js';
import { SyncStatusCards } from './sync/SyncStatusCards.js';
import { BlogSyncPanel, ProfileRefreshPanel } from './sync/AutoJobPanels.js';
import { TecoTalkPanel } from './sync/TecoTalkPanel.js';
import { MissionSyncPanel } from './sync/MissionSyncPanel.js';
import { ActiveQueueJobs } from './sync/ActiveQueueJobs.js';
import { SyncLogConsole } from './sync/SyncLogConsole.js';
import { useSyncCountdown } from './sync/useSyncCountdown.js';
import { useSyncDashboard } from './sync/useSyncDashboard.js';
import { useSyncJobStream } from './sync/useSyncJobStream.js';

export default function SyncTab() {
  const remainingTime = useSyncCountdown();
  // 작업 스트림이 끝나면 상태 카드(마지막 싱크 시각)를 다시 읽는다
  const stream = useSyncJobStream(() => void dashboard.refetchStatus());
  const dashboard = useSyncDashboard(!!stream.running);
  const { status, workspace, githubStatus, continuousRepos, tecoTalks, activeQueueJobs, recentJobs } = dashboard;

  return (
    <div className="space-y-4">
      {status && <SyncStatusCards status={status} githubStatus={githubStatus} tecoTalks={tecoTalks} />}
      <SyncScheduleStatus
        workspace={workspace}
        status={status}
        remainingTime={remainingTime}
        continuousRepos={continuousRepos}
      />
      <BlogSyncPanel workspace={workspace} />
      <ProfileRefreshPanel workspace={workspace} />
      <TecoTalkPanel tecoTalks={tecoTalks} />
      <MissionSyncPanel stream={stream} />
      {activeQueueJobs.length > 0 && <ActiveQueueJobs jobs={activeQueueJobs} />}
      {stream.logs.length > 0 && <SyncLogConsole logs={stream.logs} endRef={stream.logEndRef} />}
      {recentJobs.length > 0 && <RecentJobsTable jobs={recentJobs} />}
    </div>
  );
}
