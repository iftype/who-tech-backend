Run Jest tests. Scope is determined by $ARGUMENTS:

| Argument               | Command                    |
| ---------------------- | -------------------------- |
| (empty) or `unit`      | `npm run test:unit`        |
| `integration` or `int` | `npm run test:integration` |
| `coverage`             | `npm run test:coverage`    |
| `all`                  | `npm test`                 |

```bash
cd /Users/iftype/Projects/Side/who-tech-course/backend && npm run test:<scope>
```

Report:

- Total passed / failed / skipped counts
- Names and file paths of any failing tests
- If coverage: highlight files below threshold (lines < 60%, functions < 60%)
