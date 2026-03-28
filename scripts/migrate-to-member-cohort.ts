import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.member.findMany({
    select: {
      id: true,
      cohort: true,
      roles: true,
      githubId: true,
    },
  });

  console.log(`Found ${members.length} members to migrate.`);

  let migrated = 0;
  for (const member of members) {
    if (member.cohort === null) continue;

    try {
      await prisma.memberCohort.upsert({
        where: {
          memberId_cohort: {
            memberId: member.id,
            cohort: member.cohort,
          },
        },
        create: {
          memberId: member.id,
          cohort: member.cohort,
          roles: member.roles,
        },
        update: {
          roles: member.roles,
        },
      });
      migrated++;
    } catch (e) {
      console.error(`Failed to migrate member ${member.githubId}:`, e);
    }
  }

  console.log(`Successfully migrated ${migrated} member-cohort records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
