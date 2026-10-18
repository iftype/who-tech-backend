#!/usr/bin/env node
// 기능 폴더 단위 순환 검사 (ARCHITECTURE_PLAN A-4·C-3).
// 파일 단위로는 순환이 없어도 features/repo → features/sync → features/repo 처럼 기능끼리 서로 의존하면 순환으로 본다.
// dependency-cruiser의 JSON 결과를 기능 단위 그래프로 묶어 순환을 찾는다. --strict면 순환이 있을 때 실패한다
import { execFileSync } from 'node:child_process';

const strict = process.argv.includes('--strict');
const json = execFileSync('npx', ['depcruise', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const { modules } = JSON.parse(json);

const featureOf = (path) => /^src\/features\/([^/]+)\//.exec(path)?.[1];

// 기능 → 의존하는 다른 기능 (근거 파일 쌍 포함)
const edges = new Map();
for (const mod of modules) {
  const from = featureOf(mod.source);
  if (!from) continue;
  for (const dep of mod.dependencies) {
    const to = featureOf(dep.resolved);
    if (!to || to === from) continue;
    if (!edges.has(from)) edges.set(from, new Map());
    const evidence = edges.get(from);
    if (!evidence.has(to)) evidence.set(to, `${mod.source} → ${dep.resolved}`);
  }
}

// 서로 의존하는 기능 쌍과 그보다 긴 순환을 DFS로 찾는다
const cycles = new Set();
function visit(node, stack) {
  for (const next of edges.get(node)?.keys() ?? []) {
    const index = stack.indexOf(next);
    if (index !== -1) {
      const cycle = stack.slice(index);
      const start = cycle.indexOf([...cycle].sort()[0]);
      cycles.add([...cycle.slice(start), ...cycle.slice(0, start)].join(' → '));
    } else {
      visit(next, [...stack, next]);
    }
  }
}
for (const feature of edges.keys()) visit(feature, [feature]);

if (cycles.size === 0) {
  console.log('기능 단위 순환 없음');
} else {
  console.log(`기능 단위 순환 ${cycles.size}개`);
  for (const cycle of [...cycles].sort()) {
    const nodes = cycle.split(' → ');
    console.log(`  ${cycle} → ${nodes[0]}`);
    nodes.forEach((from, i) => {
      const to = nodes[(i + 1) % nodes.length];
      console.log(`      ${edges.get(from).get(to)}`);
    });
  }
}
if (strict && cycles.size > 0) process.exit(1);
