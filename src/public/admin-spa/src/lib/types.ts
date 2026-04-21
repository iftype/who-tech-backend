export interface MissionRepo {
  id: number;
  name: string;
  repoUrl: string;
  track: string | null;
  status: string;
  syncMode: string;
  level: string | null;
  cohorts: number[];
  _count: { submissions: number };
}

export interface Workspace {
  id: number;
  cohortRules: Record<string, number>;
  blogSyncEnabled: boolean;
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
}

export interface MemberCohort {
  cohort: number;
  roles: string[];
}

export interface BlogPost {
  id: number;
  url: string;
  title: string;
  publishedAt: string;
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
  _count: { submissions: number; blogPosts: number };
}
