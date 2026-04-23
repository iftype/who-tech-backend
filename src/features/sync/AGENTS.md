# AGENTS.md — Sync Feature Module

> Claude Code와 OpenCode 모두 이 파일을 참조합니다.

---

## 1. Module Overview

The sync module collects GitHub Pull Requests from mission repositories, parses them into member submissions, and maintains an up-to-date database of crew members, their nicknames, profiles, and blog URLs. It supports both on-demand and scheduled synchronization with real-time progress streaming.

### Key Responsibilities

- Fetch PRs from GitHub repositories via the REST API
- Parse PR metadata into structured submissions
- Detect crew cohort membership from PR timestamps
- Resolve member profiles (blog, avatar, nickname)
- Upsert members and submissions into the database
- Manage sync jobs through an in-memory queue with SSE progress tracking

---

## 2. File Structure

```
src/features/sync/
├── sync.service.ts        # Core sync orchestration
├── sync.admin.service.ts  # Admin wrapper + queue integration
├── sync.repo-sync.ts      # Per-repository sync: fetch, parse, profile resolve, upsert
├── sync.pr-parser.ts      # PR to Submission parsing with cohort detection
├── sync.queue.ts          # In-memory job queue with SSE progress
├── github.service.ts      # GitHub API client and helpers
└── sync.route.ts          # HTTP routes for admin sync endpoints
```

### File Responsibilities

| File                    | Lines | Role                                                                                                                                                 |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync.service.ts`       | 177   | Defines `syncWorkspace`, `syncContinuousRepos`, `syncCohortRepoList`. Iterates over repo lists and delegates per-repo work to `syncRepo`.            |
| `sync.admin.service.ts` | 98    | Wraps the core service for admin use. Creates and exposes the `SyncQueue`. Provides status queries and job management methods.                       |
| `sync.repo-sync.ts`     | 267   | **Heaviest file.** Handles fetching PRs for a single repo, resolving member profiles, merging nickname stats, and upserting members and submissions. |
| `sync.pr-parser.ts`     | 47    | Pure function `parsePRsToSubmissions`. Filters ghost users, resolves PR status, extracts nickname tokens, and detects cohort.                        |
| `sync.queue.ts`         | 228   | In-memory queue with job lifecycle (queued → running → completed/failed/cancelled). Supports progress and done subscriptions for SSE.                |
| `github.service.ts`     | 200   | Octokit client factory with throttling, `fetchRepoPRs`, `fetchUserProfile`, `fetchUserBlogCandidates`, and `detectCohort`.                           |
| `sync.route.ts`         | 180   | Express router. Exposes sync endpoints plus job queue endpoints with SSE streaming.                                                                  |

---

## 3. Sync Flow

The complete data flow for synchronizing a single repository:

```
fetchRepoPRs(octokit, org, repo)
  → parsePRsToSubmissions(prs, cohortRules)
  → syncRepo(octokit, workspaceId, org, repo, cohortRules)
    → fetchAndParse()         # fetch PRs + load banned words / ignored domains
    → for each submission:
      → find existing member
      → skip if common mission + unknown member
      → mergeNicknameStat()   # update nickname frequency stats
      → resolveDisplayNickname()
      → resolveProfile()      # fetch blog candidates + RSS probe
      → upsertMemberAndSubmission()
    → missionRepoRepo.touch()  # update lastSyncAt
```

### 3.1 PR Fetching Strategy

`fetchRepoPRs` uses two modes depending on `lastSyncAt`:

| Mode        | Condition           | Behavior                                                            |
| ----------- | ------------------- | ------------------------------------------------------------------- |
| Incremental | `lastSyncAt` exists | Fetch 1 page, filter by `updated_at > since` (with 5-minute buffer) |
| Full        | No `lastSyncAt`     | Fetch up to `maxPages` (30), sorted by `created_at asc`             |

All PR states are collected: `open`, `merged`, and `closed`.

### 3.2 Submission Parsing

`parsePRsToSubmissions` converts raw GitHub PRs into `ParsedSubmission` objects:

- Skips PRs with no user or where `login === 'ghost'` (deleted accounts)
- Resolves PR status: `state === 'open'` → `open`, otherwise `merged_at ? merged : closed`
- Extracts nickname tokens from the PR title using Korean character segmentation (`[^가-힣]+` split)
- Detects cohort from `created_at` using `cohortRules`

---

## 4. Cohort Detection

### Current Logic: Date-Based

`detectCohort(submittedAt, cohortRules)` maps a PR's creation year to a cohort number.

- `cohortRules` is a JSON array stored on the `Workspace` model: `[{ year: 2024, cohort: 6 }, ...]`
- Given a `submittedAt` date, it looks up the matching year and returns the cohort
- If no rule matches, the cohort is `null`

### Common Mission Behavior

Repos with `track === null` are "common missions." During sync:

- If a PR author is not already a known member, the submission is skipped
- This prevents anonymous or external PRs from creating new member records in shared repos

---

## 5. Queue System

### Architecture

`createSyncQueue` provides an in-memory job queue with sequential processing. Only one job runs at a time.

### Job Lifecycle

```
enqueue(type, cohort?) → queued
processLoop() picks next queued job → running
  on completion → completed + result
  on error → failed + error message
  on cancel() → cancelled
```

### Job Types

| Type           | Description                                             |
| -------------- | ------------------------------------------------------- |
| `workspace`    | Sync all active repos in the workspace                  |
| `continuous`   | Sync only repos with `syncMode === 'continuous'`        |
| `cohort-repos` | Sync repos linked to a specific cohort via `CohortRepo` |

### Progress Subscription

- `subscribeProgress(id, callback)` — emits per-repo progress during sync
- `subscribeDone(id, callback)` — emits when a job reaches a terminal state
- Subscribers are stored in `Map<string, Set<Callback>>` and silently ignore errors

### Cancellation

- `cancel(id)` aborts the job's `AbortController`
- If the job is `queued`, it immediately transitions to `cancelled`
- If `running`, the abort signal propagates to GitHub API requests, causing them to throw

---

## 6. SSE Progress Tracking

The sync route exposes SSE endpoints that stream real-time progress:

| Endpoint                                 | Method | Description                        |
| ---------------------------------------- | ------ | ---------------------------------- |
| `GET /sync/stream`                       | SSE    | Full workspace sync with progress  |
| `GET /sync/continuous/stream`            | SSE    | Continuous repo sync with progress |
| `GET /sync/cohort-repos/stream?cohort=N` | SSE    | Cohort repo sync with progress     |
| `GET /sync/jobs/:id/stream`              | SSE    | Stream progress for a queued job   |

### SSE Events

- `progress` — `{ repo: string, done: number, total: number, synced: number }`
- `done` — `{ totalSynced: number, reposSynced: number }`
- `error` — `{ message: string }`

### Job Queue Endpoints (non-SSE)

- `POST /sync/jobs` — enqueue a job (`type` + optional `cohort`)
- `GET /sync/jobs` — list all jobs (without abort controllers)
- `DELETE /sync/jobs/:id` — cancel a queued or running job

---

## 7. Admin Service vs Core Service

### `SyncService` (`sync.service.ts`)

- Pure business logic
- Requires explicit `octokit`, `workspaceId`, and optional `onProgress` callback
- No knowledge of HTTP, queues, or job lifecycle
- Returns sync results directly

### `SyncAdminService` (`sync.admin.service.ts`)

- Wraps `SyncService` for the admin API
- Creates and owns the `SyncQueue`
- Resolves the current workspace automatically via `workspaceService`
- Exposes job management methods: `createJob`, `getJobs`, `cancelJob`, `subscribeProgress`, `subscribeDone`
- Provides admin dashboard status: member count, repo count, last sync time, profile refresh settings

**Rule of thumb:** `SyncService` is for programmatic use. `SyncAdminService` is for the HTTP layer and admin UI.

---

## 8. GitHub API Rate Limiting

The module uses `@octokit/plugin-throttling` to handle GitHub rate limits automatically.

### Throttling Configuration

- `onRateLimit` and `onSecondaryRateLimit` both return `true`, enabling automatic retry
- Retry wait time is provided by the plugin based on GitHub's `Retry-After` headers
- Warnings are logged via `octokit.log.warn`

### AbortSignal Integration

All GitHub API calls accept an optional `AbortSignal`:

- Passed via `request: { signal }` in Octokit options
- When a sync job is cancelled, the abort signal stops in-flight HTTP requests immediately
- The sync loop checks `signal.aborted` between repos and between PRs

---

## 9. Profile Resolution Flow

When processing a PR, the syncer resolves the author's profile if stale or missing.

### Trigger Conditions

Profile resolution runs when any of the following is true:

- No existing blog URL
- No existing avatar URL
- Profile was last fetched more than 24 hours ago (`shouldRefreshProfile`)

### Resolution Steps

1. **Cache check** — Profiles are cached per sync session by `githubUserId` or `username`
2. **fetchUserBlogCandidates** — Calls GitHub API to get user profile data, then collects blog URL candidates from:
   - The `blog` field on the GitHub profile
   - URLs extracted from the `bio` text
   - Social accounts via `GET /users/{username}/social_accounts`
3. **RSS Probe** — Each candidate URL is tested with `probeRss(url)`
   - The first URL with `status === 'available'` becomes the member's blog
   - If none pass, the first candidate is kept as a fallback
4. **Ghost account handling** — If GitHub returns `login === 'ghost'`, the existing `githubId`, `blog`, and `avatarUrl` are preserved
5. **Previous GitHub IDs** — If a user changed their GitHub username, the old ID is tracked in `previousGithubIds` (JSON array)

### Ignored Domains

Domains listed in the `IgnoredDomainRepository` are filtered out during blog URL normalization. This prevents linking to generic or unwanted platforms.

---

## 10. Nickname Stats Logic

Nicknames are inferred from PR titles, not from GitHub profiles.

### Token Extraction

PR titles are split on non-Korean characters (`[^가-힣]+`). Each Korean token becomes a candidate nickname.

### Frequency Tracking

`nicknameStats` is stored as a JSON array on each member:

```json
[
  { "nickname": "빌리", "count": 5, "lastSeenAt": "2024-03-15T10:00:00Z" },
  { "nickname": "헤일리", "count": 2, "lastSeenAt": "2024-03-10T08:00:00Z" }
]
```

### Merging Rules

`mergeNicknameStat(existingStats, token, submittedAt)`:

- If the token already exists, increments `count` and updates `lastSeenAt`
- If new, appends with `count: 1`
- Invalid nicknames (length > 20) are skipped
- Stats are sorted by `count` desc, then `lastSeenAt` desc

### Display Nickname Resolution

`resolveDisplayNickname(manualNickname, statsValue, fallbackNickname)`:

1. If a `manualNickname` is set, use it
2. Otherwise, use the highest-frequency nickname from stats
3. Otherwise, normalize and use the `fallbackNickname`

### Banned Words

Tokens matching banned words (from `BannedWordRepository`) are excluded from stats entirely.

---

## 11. Repository Interactions

### MissionRepoRepository

- `findMany({ workspaceId })` — lists all repos for a workspace
- `touch(id)` — updates `lastSyncAt` after a repo finishes syncing
- Also provides `count`, `create`, `update`, and bulk deletion with cascade

### SubmissionRepository

- `upsert(args)` — the only method; upserts submissions by unique key `(prNumber, missionRepoId)`
- On update, refreshes `memberId`, `title`, `prUrl`, and `status`

### CohortRepoRepository

- `findByCohort(workspaceId, cohort)` — lists repos explicitly linked to a cohort
- Used by `syncCohortRepoList` to sync curated repo lists per cohort
- Also provides `create`, `update`, `delete`, and cohort listing

### MemberRepository

- `findByGithubUserId` / `findByGithubId` — look up existing members
- `upsert(workspaceId, githubUserId, data)` — race-condition-safe upsert by `(githubUserId, workspaceId)`
- `upsertParticipation(memberId, cohortNumber, roleName)` — links a member to a cohort with a role

---

## 12. Known Issues & Planned Improvements

### Current Issues

1. **`sync.repo-sync.ts` is too large (267 lines)**
   - It handles fetching, parsing, profile resolution, nickname stats, and upserts
   - Should be split into smaller focused modules (e.g., `profile-resolver.ts`, `nickname-merger.ts`)

2. **`console.log` in member profile refresh**
   - `member.profile-refresh.ts` (called from the sync flow) contains `console.log` statements
   - Should migrate all sync logging to `ActivityLogService`

3. **Cohort detection is date-based, not frequency-based**
   - Currently uses the year of a single PR's `created_at`
   - A member who submits PRs across multiple years could be misclassified
   - **Planned:** determine cohort by aggregating all PRs and picking the most frequent cohort

### Planned Improvements

| Improvement                             | Description                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Frequency-based cohort determination    | Count cohort occurrences across all member PRs at sync time, assign the most frequent |
| `console.log` → `activityLog` migration | Replace all direct logging with structured `ActivityLogService` calls                 |
| Split `sync.repo-sync.ts`               | Extract profile resolution and nickname logic into separate modules                   |
| Profile refresh batching                | Currently resolves profiles one-by-one during sync; could batch stale profile checks  |

---

## 13. Testing Notes

When modifying sync logic:

- Mock `Octokit` in unit tests. Never hit the real GitHub API.
- Mock `MemberRepository`, `MissionRepoRepository`, and `SubmissionRepository`.
- `fetchRepoPRs` and `fetchUserBlogCandidates` must always be mocked.
- The queue is in-memory and can be tested synchronously or with short `setTimeout` waits.
- `AbortController` cancellation paths should be tested explicitly.

---

## 14. External Dependencies

| Dependency                   | Role                          |
| ---------------------------- | ----------------------------- |
| `@octokit/rest`              | GitHub REST API client        |
| `@octokit/plugin-throttling` | Automatic rate limit handling |
| `express`                    | HTTP routes                   |

---

## 15. Related Documentation

- `.claude/docs/sync.md` — Detailed sync module documentation
- `.claude/docs/ARCHITECTURE.md` — Database schema and model relationships
- `AGENTS.md` (project root) — Global agent rules and commands
