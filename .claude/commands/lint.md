Run ESLint auto-fix and Prettier formatting on the entire project.

```bash
cd /Users/iftype/Projects/Side/who-tech-course/backend && npm run lint:fix && npm run format
```

Report:

- If clean: print "✓ No lint errors"
- If errors remain after auto-fix: list each file with its unfixable errors (these require manual resolution)
- Do not report warnings, only errors
