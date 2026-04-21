export interface AdminStatus {
  ok: boolean;
  memberCount: number;
  activeRepoCount: number;
  lastSyncAt: string | null;
}

export interface Member {
  id: number;
  githubId: string;
  githubUserId: number | null;
  nickname: string | null;
  manualNickname: string | null;
  avatarUrl: string | null;
  blog: string | null;
  lastPostedAt: string | null;
  profileFetchedAt: string | null;
  profileRefreshError: string | null;
  rssStatus: string | null;
  rssUrl: string | null;
  cohort: number | null;
  cohorts: { cohort: number; roles: string[] }[];
  roles: string[];
  track: string | null;
  _count: { submissions: number; blogPosts: number };
}
