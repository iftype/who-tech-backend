#!/usr/bin/env node
// 색상 토큰 검사 (ARCHITECTURE_PLAN D-1b). 색은 index.css @theme의 역할별 계열(base·primary·danger 등)만 쓰도록
// 원시 Tailwind 팔레트 색을 막는다. 테스트는 제외. 위반이 있으면 실패한다 (CI Lint & Test)
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const RAW_PALETTE =
  /(^|[\s:'"`])(text|bg|border|ring|divide|from|via|to|fill|stroke|outline|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

const violations = [];
for (const file of sourceFiles(ROOT)) {
  const rel = relative(ROOT, file);
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const match = RAW_PALETTE.exec(line);
      if (match) violations.push(`src/${rel}:${i + 1} 원시 팔레트 색: ${match[0].trim()}`);
      const size = /(^|[\s:'"`])text-\[\d+(\.\d+)?(px|rem)\]/.exec(line);
      if (size)
        violations.push(
          `src/${rel}:${i + 1} 임의 글자 크기: ${size[0].trim()} (text-2xs·text-xs 등 이름 있는 크기를 쓰세요)`,
        );
    });
}

if (violations.length > 0) {
  console.error(`색상 토큰 위반 ${violations.length}건 (index.css @theme의 역할별 색을 쓰거나 먼저 추가하세요)`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('색상 토큰 위반 없음');
