import prisma from '../db/prisma.js';

async function backfill() {
  const members = await prisma.member.findMany({
    where: { previousGithubIds: { not: null } },
    select: { id: true, previousGithubIds: true },
  });

  let inserted = 0;
  for (const member of members) {
    if (!member.previousGithubIds) continue;
    try {
      const ids = JSON.parse(member.previousGithubIds) as string[];
      for (const githubId of ids) {
        await prisma.previousGithubId.create({ data: { githubId, memberId: member.id } }).catch(() => null);
      }
      inserted += ids.length;
    } catch {
      // ignore parse errors
    }
  }

  console.log(`Done. Backfilled ${inserted} previous GitHub IDs for ${members.length} members.`);
}

backfill()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
