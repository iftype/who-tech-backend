import type { PrismaClient } from '@prisma/client';
import {
  ACTIVITY_SOURCES,
  MISSION_REPO_STATUSES,
  MISSION_REPO_TYPES,
  RSS_STATUSES,
  SUBMISSION_STATUSES,
  SYNC_MODES,
  TAB_CATEGORIES,
  TECOTALK_MATCH_STATUSES,
  TRACKS,
} from '../shared/domain.js';

// DB 일관성 검사 (ARCHITECTURE_PLAN F-3·F-4). 각 쿼리는 규칙을 어긴 행 수를 센다 — 모두 0이어야 한다.
// 운영(node dist/scripts/check-db-consistency.js), 리허설(scripts/db-rehearsal), CI(db-consistency 통합 테스트)가 같은 목록을 쓴다

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const allowedValue = (name: string, table: string, column: string, values: readonly string[], nullable: boolean) => ({
  name,
  sql: `SELECT COUNT(*) AS n FROM "${table}" WHERE ${nullable ? `"${column}" IS NOT NULL AND ` : ''}("${column}" IS NULL OR "${column}" NOT IN (${inList(values)}))`,
});

const jsonArray = (name: string, table: string, column: string, nullable: boolean) => ({
  name,
  sql: `SELECT COUNT(*) AS n FROM "${table}" WHERE ${nullable ? `"${column}" IS NOT NULL AND ` : ''}(NOT json_valid("${column}") OR json_type("${column}") <> 'array')`,
});

export const CONSISTENCY_CHECKS: { name: string; sql: string }[] = [
  // 이전 GitHub ID: JSON 컬럼과 PreviousGithubId 테이블이 같아야 한다 (F-1)
  {
    name: 'previous_id_missing_in_table',
    sql: `SELECT COUNT(*) AS n FROM "Member" m, json_each(m."previousGithubIds") j
          WHERE m."previousGithubIds" IS NOT NULL AND json_valid(m."previousGithubIds")
            AND NOT EXISTS (SELECT 1 FROM "PreviousGithubId" p WHERE p."memberId" = m."id" AND p."githubId" = j.value)`,
  },
  {
    name: 'previous_id_missing_in_json',
    sql: `SELECT COUNT(*) AS n FROM "PreviousGithubId" p JOIN "Member" m ON m."id" = p."memberId"
          WHERE m."previousGithubIds" IS NULL OR NOT json_valid(m."previousGithubIds")
             OR NOT EXISTS (SELECT 1 FROM json_each(m."previousGithubIds") j WHERE j.value = p."githubId")`,
  },
  // JSON 문자열 컬럼 형식 (F-4)
  jsonArray('invalid_json_previousGithubIds', 'Member', 'previousGithubIds', true),
  jsonArray('invalid_json_nicknameStats', 'Member', 'nicknameStats', true),
  jsonArray('invalid_json_cohortRules', 'Workspace', 'cohortRules', false),
  jsonArray('invalid_json_missionRepo_cohorts', 'MissionRepo', 'cohorts', true),
  {
    name: 'invalid_json_activityLog_metadata',
    sql: `SELECT COUNT(*) AS n FROM "ActivityLog" WHERE "metadata" IS NOT NULL AND NOT json_valid("metadata")`,
  },
  // 상태값 허용 목록 (F-3, shared/domain.ts)
  allowedValue('invalid_member_rssStatus', 'Member', 'rssStatus', RSS_STATUSES, false),
  allowedValue('invalid_member_track', 'Member', 'track', TRACKS, true),
  allowedValue('invalid_missionRepo_type', 'MissionRepo', 'type', MISSION_REPO_TYPES, false),
  allowedValue('invalid_missionRepo_tabCategory', 'MissionRepo', 'tabCategory', TAB_CATEGORIES, false),
  allowedValue('invalid_missionRepo_status', 'MissionRepo', 'status', MISSION_REPO_STATUSES, false),
  allowedValue('invalid_missionRepo_syncMode', 'MissionRepo', 'syncMode', SYNC_MODES, false),
  allowedValue('invalid_missionRepo_track', 'MissionRepo', 'track', TRACKS, true),
  allowedValue('invalid_submission_status', 'Submission', 'status', SUBMISSION_STATUSES, false),
  allowedValue('invalid_teamBlog_rssStatus', 'TeamBlog', 'rssStatus', RSS_STATUSES, false),
  allowedValue('invalid_tecoTalk_matchStatus', 'TecoTalk', 'matchStatus', TECOTALK_MATCH_STATUSES, false),
  allowedValue('invalid_activityLog_source', 'ActivityLog', 'source', ACTIVITY_SOURCES, true),
  // 비정규화: 블로그 글의 작성자 정보 사본이 작성자와 같아야 한다
  {
    name: 'blogpost_track_mismatch',
    sql: `SELECT COUNT(*) AS n FROM "BlogPost" b JOIN "Member" m ON m."id" = b."memberId" WHERE COALESCE(b."track", '') <> COALESCE(m."track", '')`,
  },
  {
    name: 'blogpost_workspace_mismatch',
    sql: `SELECT COUNT(*) AS n FROM "BlogPost" b JOIN "Member" m ON m."id" = b."memberId" WHERE COALESCE(b."workspaceId", -1) <> m."workspaceId"`,
  },
];

export async function runConsistencyChecks(db: PrismaClient): Promise<{ name: string; count: number }[]> {
  const results: { name: string; count: number }[] = [];
  for (const check of CONSISTENCY_CHECKS) {
    const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>(check.sql);
    results.push({ name: check.name, count: Number(rows[0]?.n ?? 0) });
  }
  return results;
}
