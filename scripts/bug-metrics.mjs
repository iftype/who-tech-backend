#!/usr/bin/env node
// 버그 처리 지표 (AGENTS.md "버그 처리 워크플로" ⑥). `bug` 라벨 Issue마다
// 기록(Issue 생성) → 수정 머지(Issue를 닫은 PR) → 운영 배포(그 머지 커밋의 Deploy 성공)까지 걸린 시간을 계산한다.
//   node scripts/bug-metrics.mjs            # 표 + 중앙값
//   node scripts/bug-metrics.mjs --json     # 원자료
// gh CLI 인증이 필요하다. 저장소는 GH_REPO(기본 iftype/who-tech-backend)
import { execFileSync } from 'node:child_process';

const REPO = process.env['GH_REPO'] ?? 'iftype/who-tech-backend';
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));

const issues = gh([
  'issue',
  'list',
  '-R',
  REPO,
  '--label',
  'bug',
  '--state',
  'all',
  '--limit',
  '200',
  '--json',
  'number,title,createdAt,closedAt,state,closedByPullRequestsReferences',
]);

const deploys = gh([
  'run',
  'list',
  '-R',
  REPO,
  '--workflow',
  'deploy.yml',
  '--limit',
  '200',
  '--json',
  'headSha,conclusion,updatedAt',
]).filter((r) => r.conclusion === 'success');

const hours = (a, b) => (a && b ? Math.round(((new Date(b) - new Date(a)) / 36e5) * 10) / 10 : null);
const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};

const rows = issues.map((issue) => {
  const pr = issue.closedByPullRequestsReferences?.[0];
  const merged = pr ? gh(['pr', 'view', String(pr.number), '-R', REPO, '--json', 'mergedAt,mergeCommit']) : null;
  const sha = merged?.mergeCommit?.oid;
  const deployedAt = sha ? (deploys.find((d) => d.headSha === sha)?.updatedAt ?? null) : null;
  return {
    issue: issue.number,
    title: issue.title,
    state: issue.state,
    pr: pr?.number ?? null,
    createdAt: issue.createdAt,
    mergedAt: merged?.mergedAt ?? null,
    deployedAt,
    toMergeH: hours(issue.createdAt, merged?.mergedAt),
    toDeployH: hours(issue.createdAt, deployedAt),
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| Issue | PR | 상태 | 기록→머지(h) | 기록→배포(h) | 제목 |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(
      `| #${r.issue} | ${r.pr ? `#${r.pr}` : '—'} | ${r.state} | ${r.toMergeH ?? '—'} | ${r.toDeployH ?? '—'} | ${r.title} |`,
    );
  }
  console.log(
    `\n버그 ${rows.length}건 · 중앙값 기록→머지 ${median(rows.map((r) => r.toMergeH)) ?? '—'}h · 기록→배포 ${median(rows.map((r) => r.toDeployH)) ?? '—'}h`,
  );
}
