-- DB 일관성 검사 (리허설·운영 공통). 모든 값이 0이어야 한다
.headers on
.mode column
-- 이전 GitHub ID: JSON 컬럼에는 있는데 테이블에 없는 것
SELECT 'previous_id_missing_in_table' AS check_name, COUNT(*) AS n
FROM Member m, json_each(m.previousGithubIds) j
WHERE m.previousGithubIds IS NOT NULL AND json_valid(m.previousGithubIds)
  AND NOT EXISTS (SELECT 1 FROM PreviousGithubId p WHERE p.memberId = m.id AND p.githubId = j.value);
-- 이전 GitHub ID: 테이블에는 있는데 JSON 컬럼에 없는 것
SELECT 'previous_id_missing_in_json' AS check_name, COUNT(*) AS n
FROM PreviousGithubId p JOIN Member m ON m.id = p.memberId
WHERE m.previousGithubIds IS NULL OR NOT json_valid(m.previousGithubIds)
  OR NOT EXISTS (SELECT 1 FROM json_each(m.previousGithubIds) j WHERE j.value = p.githubId);
-- JSON 컬럼 형식
SELECT 'invalid_json_previousGithubIds' AS check_name, COUNT(*) AS n FROM Member WHERE previousGithubIds IS NOT NULL AND (NOT json_valid(previousGithubIds) OR json_type(previousGithubIds) <> 'array');
SELECT 'invalid_json_nicknameStats' AS check_name, COUNT(*) AS n FROM Member WHERE nicknameStats IS NOT NULL AND (NOT json_valid(nicknameStats) OR json_type(nicknameStats) <> 'array');
SELECT 'invalid_json_cohortRules' AS check_name, COUNT(*) AS n FROM Workspace WHERE NOT json_valid(cohortRules) OR json_type(cohortRules) <> 'array';
SELECT 'invalid_json_missionRepo_cohorts' AS check_name, COUNT(*) AS n FROM MissionRepo WHERE cohorts IS NOT NULL AND (NOT json_valid(cohorts) OR json_type(cohorts) <> 'array');
SELECT 'invalid_json_activityLog_metadata' AS check_name, COUNT(*) AS n FROM ActivityLog WHERE metadata IS NOT NULL AND NOT json_valid(metadata);
-- 비정규화: 블로그 글의 track·workspaceId가 작성자와 다른 것
SELECT 'blogpost_track_mismatch' AS check_name, COUNT(*) AS n FROM BlogPost b JOIN Member m ON m.id = b.memberId WHERE COALESCE(b.track, '') <> COALESCE(m.track, '');
SELECT 'blogpost_workspace_mismatch' AS check_name, COUNT(*) AS n FROM BlogPost b JOIN Member m ON m.id = b.memberId WHERE COALESCE(b.workspaceId, -1) <> m.workspaceId;
