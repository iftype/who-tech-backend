Run TypeScript type check for the entire project.

```bash
cd /Users/iftype/Projects/Side/who-tech-course/backend && npx tsc --noEmit --skipLibCheck 2>&1
```

Output rules:

- If zero errors: print "✓ No type errors"
- If errors exist: group by file, show up to 3 errors per file with line numbers, summarize total count
- Do not truncate error messages — include the full error description
