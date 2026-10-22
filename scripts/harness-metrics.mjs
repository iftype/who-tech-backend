#!/usr/bin/env node
// 하네스 효과 측정. 같은 스크립트로 적용 전(기준값)과 적용 후를 잰다.
//   node scripts/harness-metrics.mjs --since 2026-10-20 [--until 2026-10-23]   # PR·CI 지표 (GitHub)
//   node scripts/harness-metrics.mjs --hook                                   # Stop 훅 로그 지표 (.git/harness/log.jsonl)
// PR 지표: 릴리스·문서만 바뀐 PR은 뺀다(실패할 일이 거의 없어 수치를 흐림)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const REPO = process.env['GH_REPO'] ?? 'iftype/who-tech-backend';
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

if (process.argv.includes('--hook')) {
  const path = '.git/harness/log.jsonl';
  const rows = existsSync(path)
    ? readFileSync(path, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const ran = rows.filter((r) => r.result !== 'skip');
  const blocked = ran.filter((r) => r.result === 'fail');
  const byCheck = {};
  for (const r of blocked) for (const c of r.checks.filter((c) => !c.ok)) byCheck[c.name] = (byCheck[c.name] ?? 0) + 1;
  console.log(`훅 실행 ${rows.length}회 (검사 ${ran.length} · 생략 ${rows.length - ran.length})`);
  console.log(
    `막음 ${blocked.length}회 (${pct(blocked.length, ran.length)}) · 포기(3회 실패) ${rows.filter((r) => r.result === 'gave-up').length}회`,
  );
  console.log(`검사 시간 중앙값 ${median(ran.map((r) => r.ms)) ?? '—'}ms`);
  console.log(
    `막은 검사: ${
      Object.entries(byCheck)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || '—'
    }`,
  );
  process.exit(0);
}

const since = arg('--since') ?? '2026-10-20';
const until = arg('--until') ?? '2100-01-01';
const prs = gh([
  'pr',
  'list',
  '-R',
  REPO,
  '--state',
  'merged',
  '--limit',
  '300',
  '--json',
  'number,title,headRefName,mergedAt,createdAt,files',
])
  .filter((p) => p.mergedAt >= since && p.mergedAt < until)
  .filter((p) => !p.headRefName.startsWith('release-please'))
  .filter((p) => !p.files.every((f) => /\.(md)$|^docs\/|^\.claude\/docs\//.test(f.path)));

const rows = prs.map((p) => {
  const runs = gh([
    'run',
    'list',
    '-R',
    REPO,
    '--workflow',
    process.env['GH_CI_WORKFLOW'] ?? 'ci.yml',
    '--branch',
    p.headRefName,
    '--event',
    'pull_request',
    '--limit',
    '50',
    '--json',
    'conclusion,createdAt,updatedAt,headSha',
  ])
    .filter(
      (r) => r.createdAt >= p.createdAt && r.createdAt <= p.mergedAt && r.conclusion && r.conclusion !== 'cancelled',
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = runs[0];
  const firstGreen = runs.find((r) => r.conclusion === 'success');
  const shas = new Set(runs.map((r) => r.headSha));
  return {
    pr: p.number,
    title: p.title,
    runs: runs.length,
    firstFailed: first ? first.conclusion !== 'success' : null,
    extraPushes: Math.max(shas.size - 1, 0),
    minutesToGreen:
      first && firstGreen ? Math.round((new Date(firstGreen.updatedAt) - new Date(first.createdAt)) / 60000) : null,
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
const measured = rows.filter((r) => r.firstFailed != null);
console.log(
  `기간 ${since} ~ ${until === '2100-01-01' ? '현재' : until} · PR ${rows.length}개 (CI 기록 있는 것 ${measured.length})`,
);
console.log(`① CI 첫 실행 실패율 ${pct(measured.filter((r) => r.firstFailed).length, measured.length)}`);
console.log(
  `② PR당 추가 push 중앙값 ${median(measured.map((r) => r.extraPushes))} · 평균 ${(measured.reduce((s, r) => s + r.extraPushes, 0) / (measured.length || 1)).toFixed(2)}`,
);
console.log(`③ 첫 실행 → 통과 시간 중앙값 ${median(measured.map((r) => r.minutesToGreen))}분`);
console.log(
  '\n첫 실행 실패 PR:',
  measured
    .filter((r) => r.firstFailed)
    .map((r) => `#${r.pr}`)
    .join(' ') || '없음',
);
