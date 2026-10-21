import type { SyncJobType } from '../../lib/types.js';

/** 싱크 큐 작업 종류의 화면 이름 (활성 목록·최근 목록이 같은 표를 쓴다) */
export const JOB_TYPE_LABEL: Record<SyncJobType, string> = {
  workspace: '전체',
  continuous: '연속',
  'cohort-repos': '기수레포',
  repo: '레포',
  blog: '블로그',
};
