// SyncTab 공용 타입과 표시 포맷

export type JobType = 'sync' | 'continuous' | 'cohort-repos';

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '없음';
}

// 레포·블로그 싱크 작업 목록 항목
