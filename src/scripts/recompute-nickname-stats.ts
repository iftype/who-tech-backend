// 닉네임 통계를 모든 제출 제목에서 다시 계산해 바로잡는다 (예전 증분 집계가 같은 PR을 여러 번 세어 부풀린 값).
// 사용: npx tsx src/scripts/recompute-nickname-stats.ts [--apply]   (기본은 바뀔 내용만 보여 주는 dry-run)
// 운영: node --env-file=.env dist/scripts/recompute-nickname-stats.js --apply (실행 전 수동 백업, .claude/docs/db-changes.md)
import prisma from '../db/prisma.js';
import { computeNicknameStats, parseNicknameStats, resolveDisplayNickname } from '../shared/nickname.js';

const apply = process.argv.includes('--apply');

const top = (value: string | null) => {
  const first = parseNicknameStats(value)[0];
  return first ? `${first.nickname}:${first.count}` : '-';
};

const bannedByWorkspace = new Map<number, Set<string>>();
for (const word of await prisma.nicknameBannedWord.findMany()) {
  const set = bannedByWorkspace.get(word.workspaceId) ?? new Set<string>();
  set.add(word.word);
  bannedByWorkspace.set(word.workspaceId, set);
}

const members = await prisma.member.findMany({
  select: {
    id: true,
    githubId: true,
    workspaceId: true,
    nickname: true,
    manualNickname: true,
    nicknameStats: true,
    submissions: { select: { title: true, submittedAt: true } },
  },
});

let statsChanged = 0;
let nicknameChanged = 0;
let countsDeflated = 0; // 같은 PR을 여러 번 세어 부풀었던 횟수가 줄어든 멤버
const total = (value: string | null) => parseNicknameStats(value).reduce((sum, stat) => sum + stat.count, 0);
const nicknameChanges: string[] = [];
for (const member of members) {
  if (member.submissions.length === 0) continue; // 제출이 없으면 계산할 근거가 없다 → 그대로
  const stats = computeNicknameStats(member.submissions, bannedByWorkspace.get(member.workspaceId) ?? new Set());
  if (stats === member.nicknameStats) continue;
  statsChanged++;
  if (total(stats) < total(member.nicknameStats)) countsDeflated++;
  // 싱크와 같은 규칙: 수동 닉네임 > 통계 1위 > 기존 닉네임
  const nickname = resolveDisplayNickname(member.manualNickname, stats, member.nickname);
  if (nickname !== member.nickname) {
    nicknameChanged++;
    nicknameChanges.push(
      `${member.githubId}: ${member.nickname ?? '-'} → ${nickname ?? '-'} (1위 ${top(member.nicknameStats)} → ${top(stats)})`,
    );
  }
  if (apply) await prisma.member.update({ where: { id: member.id }, data: { nicknameStats: stats, nickname } });
}

console.log(
  `[nickname-stats] ${apply ? 'APPLY' : 'DRY-RUN'} members=${members.length} statsChanged=${statsChanged} ` +
    `countsDeflated=${countsDeflated} nicknameChanged=${nicknameChanged}`,
);
for (const line of nicknameChanges) console.log(`  ${line}`);
await prisma.$disconnect();
