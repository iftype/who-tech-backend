import prisma from '../db/prisma.js';
import { buildCohortList } from '../shared/member-cohort.js';

async function backfill() {
  const posts = await prisma.blogPost.findMany({
    include: {
      member: {
        include: {
          memberCohorts: {
            include: { cohort: true, role: true },
          },
        },
      },
    },
  });

  let updated = 0;
  const batchSize = 100;

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((post) => {
        const cohorts = buildCohortList(post.member.memberCohorts);
        const primaryCohort = cohorts[0]?.cohort ?? null;
        return prisma.blogPost.update({
          where: { id: post.id },
          data: {
            workspaceId: post.member.workspaceId,
            cohort: primaryCohort,
            track: post.member.track,
          },
        });
      }),
    );
    updated += batch.length;
    console.log(`Progress: ${updated}/${posts.length}`);
  }

  console.log(`Done. Updated ${updated} blog posts.`);
}

backfill()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
