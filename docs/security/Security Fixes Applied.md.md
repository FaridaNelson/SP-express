# Security Fixes Applied

**Date:** 2026-03-22
**Branch:** `feature/standalone-student-architecture`
**Tests:** 110/110 passing after all changes

---

## CRITICAL FIX 1 — Secrets Management (Google Secret Manager)

### Problem
`MONGODB_URI` and `JWT_SECRET` were stored as plaintext values in `.env`, including production MongoDB Atlas credentials with embedded username and password. If `.env` were ever committed or leaked, full database access would be exposed.

### What changed

| File | Change |
|------|--------|
| `src/config/secrets.js` | **New.** `loadSecrets()` fetches `MONGODB_URI` and `JWT_SECRET` from Google Secret Manager in production. Falls back to `process.env` in development/test. Runs `validateSecrets()` to enforce presence and length. |
| `src/server.js` | Calls `await loadSecrets()` before importing the app or connecting to DB. Uses dynamic imports so env vars are populated before modules read them. |
| `.env.example` | **New.** Placeholder values, documentation for each variable, and the full `gcloud` CLI commands to create secrets in GCP. |
| `.gitignore` | Verified `.env` is ignored. Added `.mongo-test-uri` (test artifact). |
| `package.json` | Added `@google-cloud/secret-manager` dependency. |

### GCP setup commands (for production deployment)

```bash
gcloud secrets create MONGODB_URI --replication-policy="automatic"
echo -n "mongodb+srv://user:pass@cluster/db" | \
  gcloud secrets versions add MONGODB_URI --data-file=-

gcloud secrets create JWT_SECRET --replication-policy="automatic"
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))" | \
  gcloud secrets versions add JWT_SECRET --data-file=-
```

---

## CRITICAL FIX 2 — JWT Secret Hardening

### Problem
Both `src/middleware/auth.js` and `src/controllers/auth.controller.js` had a fallback: `process.env.JWT_SECRET || "dev_secret_change_me"`. The guard that threw an error only applied in production (`NODE_ENV === "production"`). Any attacker who knew the default could forge tokens in staging or misconfigured environments.

### What changed

| File | Change |
|------|--------|
| `src/middleware/auth.js` | Removed `"dev_secret_change_me"` fallback. Removed production-only guard. Replaced `const SECRET` with `getJwtSecret()` — a lazy getter that reads `process.env.JWT_SECRET` at request time and throws if unset. |
| `src/controllers/auth.controller.js` | Same treatment: removed fallback, replaced static `SECRET` with `getJwtSecret()`. |
| `src/config/secrets.js` | `validateSecrets()` enforces: (1) `JWT_SECRET` must exist in **all** environments, (2) must be at least 32 characters in dev/production (relaxed in test for CI convenience). |

### Why lazy getters instead of a top-level constant

With ESM, `import` statements are hoisted and evaluated before any code in the file runs. In production, `loadSecrets()` fetches values from GCP **after** modules are already imported. A top-level `const SECRET = process.env.JWT_SECRET` would capture `undefined` before GCP secrets arrive. The `getJwtSecret()` function reads `process.env` at request time, after secrets are loaded.

---

## HIGH FIX 1 — Schema String Length Limits

### Problem
Free-text fields like `teacherNarrative`, `closingNote`, `withdrawalReason` had no `maxlength` constraints, allowing arbitrarily large payloads that pass the 10 MB JSON limit but bloat the database.

### What changed
| Field | Limit |
|-------|-------|
| `Lesson.teacherNarrative` | 2000 |
| `ExamPreparationCycle.examLocation` | 200 |
| `ExamPreparationCycle.withdrawalReason` | 500 |
| `ExamPreparationCycle.closingNote` | 1000 |
| `ScoreEntry.dynamics` | 500 (was 1000 via shared constant) |
| `ScoreEntry.articulation` | 500 (was 1000 via shared constant) |

`TeacherStudentAccess.note` already had `maxlength: 1000` — no change needed.

---

## HIGH FIX 2 — ObjectId Validation Middleware

### Problem
Invalid ObjectId strings in route params (e.g. `/api/students/abc`) caused Mongoose `CastError` exceptions, surfacing as 500s or leaking internal error details.

### What changed
| File | Change |
|------|--------|
| `src/middleware/validateObjectId.js` | **New.** `validateObjectId(...paramNames)` returns 400 with `"Invalid {paramName}"` for non-ObjectId values. |
| All 5 route files | Wired `validateObjectId()` onto every route with `:studentId`, `:cycleId`, `:lessonId`, `:teacherId`, `:accessId`, `:id` params. |

---

## HIGH FIX 3 — Global Rate Limiter

### Problem
Only auth routes had rate limiting. Authenticated users could abuse write endpoints at arbitrary rates, triggering expensive summary recomputations.

### What changed
| File | Change |
|------|--------|
| `src/app.js` | Added `100 req/min per IP` global limiter on all `/api/` routes. Auth routes retain their stricter limiter on top. Bypassed in test mode. |

---

## MEDIUM FIX 1 — NoSQL Injection Sanitization

### Problem
`req.body` could contain MongoDB operators like `{ "$gt": "" }`, enabling NoSQL injection on any endpoint that passes body fields into Mongoose queries.

### What changed
| File | Change |
|------|--------|
| `src/app.js` | Added `express-mongo-sanitize` to strip `$` and `.` operators from `req.body` and `req.params`. Express 5 makes `req.query` read-only, so `mongoSanitize.sanitize()` is called manually on body/params instead of as global middleware. |

---

## MEDIUM FIX 2 — Query Parameter Consistency

### Problem
Query parameters like `instrument`, `includeArchived`, `status`, `role` were validated inconsistently across controllers — some validated, some didn't.

### What changed
| File | Change |
|------|--------|
| `src/utils/queryParams.js` | **New.** `parseBoolean(val)` — returns `true` only for literal `"true"`. `parseEnum(val, allowed, label)` — returns value if valid, throws 400 if not. Exports `ALLOWED_INSTRUMENTS`. |
| `src/controllers/examCycle.controller.js` | `listExamCyclesForStudent`: `instrument` now validated via `parseEnum()`, `includeArchived` via `parseBoolean()`. |
| `src/controllers/lesson.controller.js` | `listLessonsForStudent` and `getLatestLessonForStudent`: `instrument` now validated via `parseEnum()`. |

`teacherStudentAccess.controller.js` already validated all query params inline — no change needed.

---

## MEDIUM FIX 3 — String ID Comparison Safety

### Problem
Comparing ObjectIds with `===` between mixed types (ObjectId vs string) can silently fail.

### Audit result
All ID comparisons in the codebase already use the `String(a) === String(b)` pattern consistently. No changes were needed:
- `examCycle.controller.js` — 4 comparisons, all wrapped in `String()`
- `lesson.controller.js` — 1 comparison, wrapped
- `scoreEntry.controller.js` — 1 comparison, wrapped
- `teacherStudentAccess.controller.js` — 2 comparisons, wrapped

---

## MEDIUM FIX 4 — Parent Access Scope Hardening

### Problem
The admin bypass path in parent endpoints had no audit trail. Without logging, a compromised admin account accessing student data would leave no forensic evidence.

### Audit & changes
| Check | Status |
|-------|--------|
| `parentId` always from `req.user._id` (server-side) | Already correct — `getParentId(req)` reads from JWT |
| Unlinked student returns 404 (not 403) | Already correct — query includes `parentIds` filter |
| Admin bypass logs audit event | **Fixed** — added `logAdminParentAccess()` helper |

| File | Change |
|------|--------|
| `src/controllers/parent.controller.js` | Added `AuditLog` import and `logAdminParentAccess()`. Admin access to `getParentStudents` logs `ADMIN_LIST_ALL_STUDENTS`. Admin access to `getParentStudentProgress` logs `ADMIN_VIEW_STUDENT_PROGRESS`. Both include `{ adminBypass: true }` metadata. |

---

## Test impact

3 new tests added (110 total):
- **NoSQL injection on login body** — confirms `{ "$gt": "" }` is sanitized, returns 400 not 500
- **Invalid enum in query param** — confirms `?instrument=Drums` returns 400
- **Admin audit on parent-scoped access** — confirms `ADMIN_LIST_ALL_STUDENTS` audit log is created

---

## Full Sprint Summary

| Severity | # | Fix | Status |
|----------|---|-----|--------|
| CRITICAL | 1 | Secrets Management (GCP Secret Manager) | Done |
| CRITICAL | 2 | JWT Secret Hardening (no fallback, lazy getter, 32-char min) | Done |
| HIGH | 1 | Schema maxlength on 6 text fields | Done |
| HIGH | 2 | ObjectId validation middleware on all routes | Done |
| HIGH | 3 | Global rate limiter (100 req/min/IP) | Done |
| HIGH | 4 | Admin permission granularity | Deferred (architectural) |
| MEDIUM | 1 | NoSQL injection sanitization (express-mongo-sanitize) | Done |
| MEDIUM | 2 | Query param validation (parseEnum/parseBoolean helpers) | Done |
| MEDIUM | 3 | String ID comparison safety | Verified correct — no changes needed |
| MEDIUM | 4 | Parent access scope + admin audit logging | Done |

**Tests:** 102 → 110 across the sprint. All passing.
