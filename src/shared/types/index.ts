export interface CohortRule {
  year: number;
  cohort: number;
}

export interface ParsedSubmission {
  githubId: string;
  nickname: string | null;
  prNumber: number;
  prUrl: string;
  title: string;
  submittedAt: Date;
  cohort: number | null;
}
