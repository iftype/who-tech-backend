# AGENTS.md — activity-log feature module

> This module records operational events for observability and rate limiting.

---

## 1. Current Structure

### Service (`activity-log.service.ts`)

| Method                  | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `getLogs(limit?)`       | Fetch recent logs for the current workspace |
| `addLog(type, message)` | Append a new log entry                      |
| `clearLogs()`           | Delete all logs for the current workspace   |

The service resolves the current workspace via `WorkspaceService.getOrThrow()` before every operation.

### Repository (`activity-log.repository.ts`)

| Method                                   | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `findMany(workspaceId, limit = 200)`     | Ordered by `createdAt DESC`, capped at 200              |
| `create({ type, message, workspaceId })` | Insert a log and prune stale records in one transaction |
| `deleteAll(workspaceId)`                 | Remove every log row for the workspace                  |

### HTTP Routes (`activity-log.route.ts`)

All routes are mounted under `/admin/logs`.

| Method | Path | Action                                  |
| ------ | ---- | --------------------------------------- |
| GET    | `/`  | Return recent logs                      |
| POST   | `/`  | Accept `{ type, message }` and store it |
| DELETE | `/`  | Purge all logs for the workspace        |

---

## 2. Current Retention Policy

- **Time window:** 7 days (`RETENTION_DAYS = 7`)
- **Hard limit:** 200 rows per query (`take: 200`)
- **Cleanup style:** Lazy (pruned inside the same transaction as `create`)
- **Prune condition:** `createdAt < now() - 7 days`

This keeps writes cheap while preventing unbounded growth.

---

## 3. Current Schema

```prisma
model ActivityLog {
  id          Int       @id @default(autoincrement())
  type        String
  message     String
  workspaceId Int
  createdAt   DateTime  @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

- `type` is a free-form string. Callers pass values such as `"sync"`, `"sync_error"`, or `"blog_sync"`.
- `message` is human-readable text.
- No indexes beyond the primary key.

---

## 4. Consumers

The following services write into this module:

- **SyncService** — logs sync operations and errors
- **SyncAdminService** — logs admin-triggered syncs
- **SyncQueue** — logs job completion events
- **BlogAdminService** — logs blog sync operations

---

## 5. Planned Expansion

### 5.1 Schema additions

| Field            | Type                  | Purpose                                                                        |
| ---------------- | --------------------- | ------------------------------------------------------------------------------ |
| `source`         | `"admin" \| "client"` | Distinguish dashboard actions from API requests                                |
| `memberGithubId` | `String?`             | Target member when the log relates to a specific user (rate limit tracking)    |
| `metadata`       | `String?`             | Optional JSON blob for extensibility: `remainingSeconds`, `requestCount`, etc. |

### 5.2 Retention policy upgrade

- **Time window:** 3 months rolling
- **Hard limit:** None (SQLite capacity is sufficient for this volume)
- **Cleanup style:** Keep lazy prune on write, but extend the cutoff to 90 days

### 5.3 Standardized log types

Planned values for the `type` field:

- `refresh_member`
- `refresh_all`
- `rate_limit_member`
- `rate_limit_all`
- `sync`
- `sync_error`
- `cohort_recalculated`

### 5.4 Planned indexes

| Columns          | Reason                                   |
| ---------------- | ---------------------------------------- |
| `type`           | Filter logs by category                  |
| `memberGithubId` | Rate limit lookups per user              |
| `source`         | Separate admin noise from client traffic |
| `createdAt`      | Time-range scans and ordering            |

### 5.5 Planned repository queries

| Query                | Signature                                     | Use case                                     |
| -------------------- | --------------------------------------------- | -------------------------------------------- |
| `countByMember`      | `(memberGithubId, since) => number`           | Rate limit check (how many recent requests?) |
| `findLatestByMember` | `(memberGithubId) => ActivityLog?`            | Last request timestamp                       |
| `findManyByType`     | `(type, workspaceId, limit) => ActivityLog[]` | Filtered admin log view                      |

---

## 6. Notes for Agents

- Do **not** add Prisma indexes directly in `schema.prisma` unless you also run `/migrate`.
- The current `type` field is un-enforced. When expanding, keep backward-compatible strings so existing logs remain readable.
- `metadata` should stay opaque to the repository. Parse it in the service layer or leave it as a raw string.
