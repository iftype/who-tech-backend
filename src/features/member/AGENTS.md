# AGENTS.md — Member Feature Module

> This file documents the member feature module located at `src/features/member/`.
> It covers file responsibilities, business rules, API endpoints, and planned improvements.

---

## 1. Module Overview

The member module manages course participants (members). It handles member CRUD operations, profile synchronization with GitHub, nickname resolution, cohort assignment, and public search APIs.

---

## 2. File Structure and Responsibilities

### Core Files

| File                        | Lines | Responsibility                                                                                                  |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `member.service.ts`         | 336   | Main business logic. CRUD, profile refresh orchestration, cohort management, bulk operations.                   |
| `member.profile-refresh.ts` | 137   | Single-member profile refresh. GitHub API lookup, RSS blog probe, nickname recalculation, cohort recalculation. |
| `member.response.ts`        | 39    | Response DTO transformation. Converts `MemberWithRelations` to public-facing response shape.                    |
| `member.route.ts`           | 166   | Admin router. All endpoints under `/admin/members/*`.                                                           |
| `member.public.route.ts`    | 67    | Public router. All endpoints under `/members/*`.                                                                |
| `member.public.service.ts`  | 222   | Public business logic. Member search, detail view with archive, feed aggregation.                               |

### Key Dependencies

| Dependency                                                           | Responsibility                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `MemberRepository` (`src/db/repositories/member.repository.ts`)      | Prisma-based data access for members, participations, and cohorts. |
| `BlogPostRepository` (`src/db/repositories/blog-post.repository.ts`) | Blog post queries for member feeds and individual post lists.      |
| `BannedWordRepository`                                               | Nickname filtering during profile refresh.                         |
| `WorkspaceService`                                                   | Workspace context retrieval and cohort rules.                      |
| `Octokit`                                                            | GitHub API client for profile and blog candidate fetching.         |

---

## 3. Dependency Injection Pattern

Both services use factory functions that receive repositories and services as dependencies.

### `createMemberService(deps)`

Receives:

- `memberRepo: MemberRepository`
- `blogPostRepo: BlogPostRepository`
- `bannedWordRepo: BannedWordRepository`
- `workspaceService: WorkspaceService`
- `octokit: Octokit`

Returns a `MemberService` object with methods for admin operations.

### `createMemberPublicService(deps)`

Receives:

- `memberRepo: MemberRepository`
- `blogPostRepo: BlogPostRepository`
- `cohortRepoRepo: CohortRepoRepository`
- `workspaceService: WorkspaceService`

Returns a `MemberPublicService` object with methods for public-facing operations.

This pattern keeps business logic testable and avoids direct Prisma or Octokit usage in services.

---

## 4. Profile Refresh Flow (`member.profile-refresh.ts`)

The `refreshMemberProfileById` function performs a complete refresh of a single member's profile.

### Steps

1. **Nickname Recalculation (always runs)**
   - Iterates all submissions and extracts Korean tokens from PR titles.
   - Filters out banned words.
   - Merges token frequency stats into `nicknameStats` JSON.
   - Resolves display nickname priority: manualNickname > highest frequency stat > fallback.

2. **GitHub Profile Fetch (conditional)**
   - Only runs when `fetchGithub` parameter is true.
   - Calls `fetchUserBlogCandidates` to get profile info and blog URL candidates.
   - Probes each candidate URL for RSS availability via `probeRss`.
   - Selects the first RSS-valid URL, or falls back to the first candidate.
   - Tracks previous GitHub IDs when username changes.
   - On failure, logs the error and preserves existing fields.

3. **Cohort Recalculation (always runs if rules exist)**
   - Runs independently of GitHub fetch success.
   - Analyzes submission dates against workspace cohort rules.
   - Applies frequency-based cohort determination (see section 7).

### Important Notes

- Profile refresh errors are stored in `profileRefreshError` and returned in responses.
- `profileFetchedAt` is only updated when GitHub fetch actually runs.
- Nickname stats are recalculated from scratch on every refresh.

---

## 5. Cohort Recalculation Logic (Frequency-Based)

The cohort recalculation algorithm determines which cohorts a member belongs to based on their submission history.

### Algorithm

1. Build a frequency map of cohorts from all submissions.
   - Each submission's `submittedAt` date is matched against workspace `cohortRules` (year-to-cohort mapping).
   - Cohort frequency = count of submissions falling into that cohort's year range.

2. For each existing cohort participation:
   - If the member has a staff role (`coach` or `reviewer`) in that cohort, it is **preserved regardless** of submission data.
   - If the cohort has zero submissions, the participation is removed.

3. For remaining non-staff cohorts:
   - Find the dominant cohort (highest submission frequency).
   - Remove all other non-staff cohort participations.
   - If the dominant cohort is not already present, create a new `crew` participation for it.

### Parameters

| Parameter        | Value | Description                                               |
| ---------------- | ----- | --------------------------------------------------------- |
| `minSubmissions` | 3     | Minimum submissions required for cohort consideration.    |
| `minDominance`   | 0.5   | Minimum ratio of submissions in dominant cohort vs total. |

### Tie-Breaking

When two cohorts have equal submission counts, the **latest cohort** (higher number) wins.

### Staff Role Preservation

Members with `coach` or `reviewer` roles in any cohort keep those participations even if they have no submissions for that cohort.

---

## 6. API Endpoints

### Admin Routes (`/admin/members/*`)

| Method | Endpoint                   | Description                                                  |
| ------ | -------------------------- | ------------------------------------------------------------ |
| GET    | `/`                        | List members with filters (q, cohort, hasBlog, track, role). |
| POST   | `/`                        | Create a new member. Requires `githubId` or `githubUserId`.  |
| GET    | `/cohorts`                 | List all cohort numbers present in the workspace.            |
| GET    | `/:id`                     | Get member detail by ID.                                     |
| GET    | `/:id/blog-posts`          | Get blog posts for a member (latest + archive).              |
| POST   | `/refresh-profiles`        | Bulk refresh profiles. Supports limit, cohort, staleHours.   |
| POST   | `/:id/refresh-profile`     | Refresh a single member's profile.                           |
| PATCH  | `/:id`                     | Update member fields (nickname, blog, roles, cohort, track). |
| PATCH  | `/:id/cohorts/:cohort`     | Move a member from one cohort to another.                    |
| DELETE | `/:id/cohorts/:cohort`     | Remove a member from a specific cohort.                      |
| POST   | `/:id/recalculate-cohorts` | Manually trigger cohort recalculation for a member.          |
| DELETE | `/`                        | Delete all members in the workspace.                         |
| DELETE | `/:id`                     | Delete a single member and all related data.                 |

### Public Routes (`/members/*`)

| Method | Endpoint     | Description                                                    |
| ------ | ------------ | -------------------------------------------------------------- |
| GET    | `/`          | Search members with filters (q, cohort, track, role).          |
| GET    | `/feed`      | Get recent blog post feed. Supports cohort, track, role, days. |
| GET    | `/:githubId` | Get public member detail including archive.                    |

---

## 7. Planned Rate Limiting Rules

The following rate limiting rules are planned for refresh endpoints.

### Individual Refresh (`POST /admin/members/:id/refresh-profile`)

| Property            | Value               |
| ------------------- | ------------------- |
| Window              | 1 minute per member |
| Log type on success | `refresh_member`    |
| Log type on limit   | `rate_limit_member` |

### Bulk Refresh (`POST /admin/members/refresh-profiles`)

| Property            | Value                  |
| ------------------- | ---------------------- |
| Window              | 24 hours per workspace |
| Restriction         | Admin only             |
| Log type on success | `refresh_all`          |
| Log type on limit   | `rate_limit_all`       |

### Source Distinction

| Source   | Description                                              |
| -------- | -------------------------------------------------------- |
| `admin`  | Request originated from admin UI or admin API key.       |
| `client` | Request originated from public client or automated sync. |

---

## 8. Response DTO (`member.response.ts`)

The `toMemberResponse` function transforms `MemberWithRelations` into a standardized shape.

### Key Fields

| Field      | Source                                            | Notes                               |
| ---------- | ------------------------------------------------- | ----------------------------------- |
| `nickname` | `resolveDisplayNickname(manual, stats, fallback)` | Priority: manual > stats > fallback |
| `cohort`   | Primary cohort (first in desc-sorted list)        | Null if no cohorts                  |
| `roles`    | Roles from primary cohort                         | Defaults to `['crew']`              |
| `tracks`   | Union of manual track + submission tracks         | Deduplicated                        |
| `cohorts`  | Full cohort list with roles                       | Descending by cohort number         |

---

## 9. Nickname Resolution Rules

Defined in `src/shared/nickname.ts` and used across member services.

### Token Extraction

- PR titles are split by non-Korean characters (`[^가-힣]+`).
- Only Korean character sequences become tokens.

### Filtering

- Banned words (from workspace config) are excluded from stats.
- Nicknames longer than 20 characters are invalid.

### Display Priority

1. `manualNickname` (admin override)
2. Highest frequency token from `nicknameStats`
3. Existing `nickname` field (fallback)

### Stats Sorting

Tokens are sorted by count (desc), then by last seen date (desc).

---

## 10. Current Issues and Technical Debt

1. **Console.log in production code**
   - `member.profile-refresh.ts` lines 127, 129 contain `console.log` calls.
   - These should be replaced with a proper logger or removed.

2. **No rate limiting on refresh endpoints**
   - Both individual and bulk refresh endpoints lack rate limiting.
   - This can lead to GitHub API abuse and excessive load.

3. **Cohort recalculation runs on every refresh**
   - The cohort recalculation logic executes even when submission data hasn't changed.
   - This is expensive for members with many submissions.

4. **Missing `minSubmissions` and `minDominance` enforcement**
   - The cohort frequency parameters (3 submissions, 0.5 dominance) are documented but not yet implemented in the recalculation logic.

---

## 11. Related Files Outside This Module

| File                                          | Relevance                                                     |
| --------------------------------------------- | ------------------------------------------------------------- |
| `src/shared/nickname.ts`                      | Nickname token extraction, normalization, stats merging       |
| `src/shared/member-cohort.ts`                 | `buildCohortList` utility for cohort/role aggregation         |
| `src/shared/github-profile.ts`                | Previous GitHub ID tracking, stale profile detection          |
| `src/db/repositories/member.repository.ts`    | Member data access with relations                             |
| `src/db/repositories/blog-post.repository.ts` | Blog post queries for feed and member posts                   |
| `src/features/sync/github.service.ts`         | `fetchUserProfile`, `fetchUserBlogCandidates`, `detectCohort` |
| `src/features/blog/blog.rss.ts`               | `probeRss` for RSS feed detection                             |
