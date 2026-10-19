// 동기화 작업 큐가 다른 기능에 맡기는 일. sync가 repo·blog 기능을 직접 import하지 않도록 필요한 모양만 여기 정의하고,
// 실제 구현(RepoService·BlogAdminService)은 app 조립 코드에서 꽂는다 (의존성 역전 — repo↔sync 순환을 끊는다)

export type SyncProgress = { total: number; processed: number; synced: number; percent: number; phase: string };

export type RepoSyncFailure = { prNumber: number; prUrl: string; error: string };

export interface RepoSyncRunner {
  executeRepoSync(
    repoId: number,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<{ synced: number; failures?: RepoSyncFailure[] }>;
}

export type BlogSyncSource = 'manual' | 'github-actions' | 'scheduler';

export interface WorkspaceBlogSyncRunner {
  executeWorkspaceBlogSync(
    source?: BlogSyncSource,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<{ synced: number }>;
}
