Safe Prisma migration workflow.

Step 1 — Show current migration state:

```bash
cd /Users/iftype/Projects/Side/who-tech-course/backend && npx prisma migrate status
```

Step 2 — Ask the user for a migration name (snake_case, e.g. `add_person_table`).

Step 3 — Run migration with the confirmed name:

```bash
npx prisma migrate dev --name <confirmed_name>
```

Step 4 — Regenerate Prisma client:

```bash
npx prisma generate
```

Report:

- Which tables/columns were created, modified, or dropped
- Whether the migration file was created successfully
- Any warnings about data loss
