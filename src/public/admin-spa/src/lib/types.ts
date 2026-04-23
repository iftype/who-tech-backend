export interface MissionRepo {
  id: number;
  name: string;
  repoUrl: string;
  track: string | null;
  type: string;
  tabCategory: string;
  status: string;
  syncMode: string;
  level: number | null;
  cohorts: number[];
  description: string | null;
  lastSyncAt: string | null;
  _count: { submissions: number };
}

export interface Workspace {
  id: number;
  cohortRules: Record<string, number>;
  blogSyncEnabled: boolean;
  profileRefreshEnabled: boolean;
}

export interface BannedWord {
  id: number;
  word: string;
}

export interface IgnoredDomain {
  id: number;
  domain: string;
}

export interface NewBlogPost {
  id: number;
  url: string;
  title: string;
  publishedAt: string;
  member: { githubId: string; nickname: string | null };
}

export interface AdminStatus {
  ok: boolean;
  memberCount: number;
  activeRepoCount: number;
  lastSyncAt: string | null;
  profileRefreshEnabled: boolean;
  lastProfileRefreshAt: string | null;
}

export interface GithubStatus {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: string | null;
}

export interface MemberCohort {
  cohort: number;
  roles: string[];
}

export interface PersonMember {
  id: number;
  githubId: string;
  nickname: string | null;
  manualNickname: string | null;
  avatarUrl: string | null;
  memberCohorts: Array<{
    cohort: { id: number; number: number };
    role: { id: number; name: string };
  }>;
}

export interface Person {
  id: number;
  displayName: string | null;
  note: string | null;
  createdAt: string;
  members: PersonMember[];
}

export interface ActivityLog {
  id: number;
  type: string;
  message: string;
  createdAt: string;
}

export interface BlogPost {
  id: number;
  url: string;
  title: string;
  publishedAt: string;
}

export interface SyncQueueJob {
  id: string;
  type: 'workspace' | 'continuous' | 'cohort-repos';
  cohort?: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: { repo: string; done: number; total: number; synced: number };
  result?: { totalSynced: number; reposSynced: number };
  error?: string;
}

export interface CohortRepo {
  id: number;
  cohort: number;
  order: number;
  missionRepoId: number;
  missionRepo: {
    id: number;
    name: string;
    repoUrl: string;
    track: string | null;
    level: number | null;
    tabCategory: string;
  };
}

export interface Submission {
  id: number;
  prNumber: number;
  prUrl: string;
  title: string;
  status: string;
  submittedAt: string;
  missionRepo: {
    id: number;
    name: string;
    track: string | null;
    tabCategory: string;
  };
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
  rssCheckedAt: string | null;
  cohort: number | null;
  cohorts: MemberCohort[];
  roles: string[];
  track: string | null;
  tracks: string[];
  blogPosts: BlogPost[];
  submissions: Submission[];
  _count: { submissions: number; blogPosts: number };
}
