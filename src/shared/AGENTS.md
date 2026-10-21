# AGENTS.md — Shared Module

> Shared utilities, middleware, and types used across all feature modules.

---

## Module Purpose

This module contains pure functions, Express middleware, error handling primitives, and shared TypeScript interfaces. Nothing in this folder depends on feature-specific business logic. All utilities are stateless and reusable.

---

## File Responsibilities

### `blog.ts`

Cleans and validates raw blog URL strings from user profiles.

- `normalizeBlogUrl(blogUrl, ignoredDomains?)`
  - Strips whitespace and trailing slashes
  - Rejects pure email addresses, credentials in URLs, and known non-blog domains (Notion, Instagram, YouTube, etc.)
  - Prepends `https://` if no protocol is present
  - Returns `null` for any invalid or ignored input

### `cohort-regex.ts`

Safely parses JSON cohort arrays stored as strings in the database.

- `parseCohorts(raw)`
  - Parses a JSON string into a `number[]`
  - Returns an empty array on any parse failure or null input

### `constants.ts`

Shared constant values.

- `WORKSPACE_NAME` — the default workspace identifier (`woowacourse`)

### `github-profile.ts`

Tracks GitHub username history and decides when to refresh cached profile data.

- `parsePreviousGithubIds(raw)` — parses a JSON string of past GitHub IDs into a string array
- `mergePreviousGithubIds(raw, current, next)` — accumulates previous IDs into a JSON string while deduplicating and removing the current active ID
- `shouldRefreshProfile(profileFetchedAt, staleHours?)` — returns `true` if the cached profile is older than the given threshold (default 24 hours)

### `blog.ts` guards

- `matchesDomain(host, domain)` — ignored domains match only on a dot boundary (`x.com` no longer drops `netflix.com`)
- `isPublicHostname(host)` — blog URLs come from GitHub profiles (outside input). Loopback, private, link-local (cloud metadata), CGNAT, multicast, single-label and numeric-IP hosts are rejected; `infra/rss/safe-fetch.ts` re-checks every redirect hop

### `http.ts`

HTTP error class.

- `HttpError(statusCode, message)` — throwable error that carries an HTTP status code
- `badRequest(message)` — throws `HttpError(400, message)`

### `errors.ts`

Domain errors compared by type, never by message string.

- `CancelledError` (message `'cancelled'`) and `throwIfCancelled(signal)` — sync cancellation
- `NotFoundError(message)` — `HttpError(404)`; admin answers `404 { message }`, the public refresh route answers `404 { error }`

### `member-cohort.ts`

Transforms raw `MemberCohort` join data into a sorted display list.

- `buildCohortList(memberCohorts)`
  - Groups roles by cohort number
  - Returns the list sorted in descending cohort order (newest first)

### `nickname.ts`

Nickname extraction, normalization, frequency tracking, and display resolution.

- `extractNicknameTokens(title)` — splits a PR title on non-Korean characters and returns only the Korean tokens
- `normalizeNickname(nickname)` — strips brackets, special characters, and trailing punctuation
- `parseNicknameStats(value)` / `stringifyNicknameStats(stats)` — JSON serialization helpers for the `nicknameStats` column
- `isValidNickname(nickname)` — basic length guard (max 20 characters)
- `mergeNicknameStat(existingValue, nickname, submittedAt)` — adds one occurrence (building block)
- `computeNicknameStats(submissions, bannedWords)` — recounts from all submission titles; idempotent. Used by sync and profile refresh
- `resolveDisplayNickname(manual, stats, current)` — manual override, then the most frequent token (the current nickname wins a tie), then the normalized fallback

### `prisma-error.ts`

Type guard for Prisma-specific errors.

- `isUniqueConstraintError(error)` — checks whether the error object represents a Prisma `P2002` unique-constraint violation

### `regex-detector.ts`

Inspects a sample of PR titles to guess which regex pattern extracts the nickname prefix.

- `detectRegexFromTitles(titles)`
  - Priority order: `]` bracket format, dash separators (`-`, `–`, `—`), colon separator, or first whitespace-delimited token
  - Returns a regex string suitable for `new RegExp()`

### `sse-handler.ts`

Utilities for Server-Sent Events responses.

- `startSse(res)` — sets SSE headers (`text/event-stream`, no cache, keep-alive) and returns a `send(event, data)` function
- `runSseJob(res, send, job)` — runs a promise and automatically emits `done` or `error` events before closing the response; writes a `: ping` comment every 25s meanwhile so the nginx 300s read timeout does not cut a stream waiting in the queue

### `validation.ts`

Input sanitization and structured body parsing for admin API endpoints.

- `parseNumberQuery(value)` — converts a query parameter to a number (returns `NaN` on failure)
- `parseOptionalNumberQuery(value)` — same as above but returns `undefined` instead of `NaN`
- `parseId(value)` — validates a route parameter as a numeric ID, throws `badRequest` on invalid or array input
- `parseNullableString(value, fieldName)` — accepts a string or `null`, throws on anything else
- `parseWorkspaceUpdateInput(body)` — validates and extracts `cohortRules`, `blogSyncEnabled`, and `profileRefreshEnabled`
- `parseRepoCreateInput(body)` — validates the full payload for creating a `MissionRepo`
- `parseRepoUpdateInput(body)` — validates the partial payload for updating a `MissionRepo`

### `middleware/auth.ts`

- `adminAuth(req, res, next)` — protects admin routes by checking `Authorization: Bearer <token>` header or `?token=` query parameter against `ADMIN_SECRET`. Returns 401 if the token is missing or mismatched.

### `middleware/error.ts`

- `errorHandler(error, req, res, next)` — the final Express error handler.
  - If the error is an `HttpError`, responds with the stored status code and message
  - Otherwise logs the error and returns a generic 500 response

### `types/index.ts`

Shared TypeScript interfaces and type aliases used by multiple features.

- `CohortRule` — maps a calendar year to a cohort number (`{ year, cohort }`)
- `NicknameStat` — a single nickname entry with occurrence count and last seen timestamp
- `PrStatus` — union type: `'open' | 'closed' | 'merged'`
- `ParsedSubmission` — normalized shape of a PR after parsing, ready for database upsert

---

## Middleware Chain

Every protected Express route follows this order:

```
adminAuth → async route handler → errorHandler
```

1. `adminAuth` intercepts unauthenticated requests before they reach business logic
2. The route handler performs validation, calls services, and sends a response
3. If anything throws (including `badRequest`), `errorHandler` catches it and formats the JSON error response

---

## Async Route Handlers

Express 5 forwards a rejected promise from an async handler to `next(error)`, so handlers are plain `async (req, res) => {}` — the old `asyncHandler` wrapper was removed (75 call sites). Throw `HttpError`/`NotFoundError` (or call `badRequest`) and `errorHandler` formats the JSON response.

---

## Design Patterns

- **Pure functions** — `blog.ts`, `cohort-regex.ts`, `nickname.ts`, `github-profile.ts`, and `member-cohort.ts` contain only pure, stateless transformations with no side effects
- **Error classes** — `HttpError` provides a single, type-safe way to communicate HTTP status from deep in the call stack back to the error middleware
- **Type guards** — `prisma-error.ts` and the internal `isRecord` / `isNumberArray` helpers in `validation.ts` narrow `unknown` values safely
- **JSON column adapters** — `parseCohorts`, `parsePreviousGithubIds`, `parseNicknameStats`, and `stringifyNicknameStats` bridge SQLite string columns and typed arrays/objects
