# StudioPulse API — Security Audit Report

**Date:** 2026-03-22
**Branch:** `feature/standalone-student-architecture`
**Scope:** All controllers, middleware, models, routes, and services in `/src/`

---

## Executive Summary

The StudioPulse Express API has a solid security foundation: HTTP-only JWT cookies, role-based access control, centralized authorization via `access.service.js`, audit logging, and recent patches (commit `b966918`) addressing privilege escalation, BOLA/IDOR, and JWT payload minimization. Several authorization, validation, and hardening gaps remain.

---

## Phase 2: Authorization & Access Control

### 2.1 HIGH — No Admin Permission Granularity

**Files:** All controllers
**Issue:** The `admin` role bypasses every access check uniformly. No distinction exists between read-only admin, super admin, or scoped admin.
**Risk:** A single compromised admin account has unrestricted access to all data and operations.
**Recommendation:** Implement scoped admin permissions (e.g., `admin:read`, `admin:write`, `admin:manage-users`).

### 2.2 HIGH — Thin Layered Defense on Student-Scoped Routes

**Files:** `src/routes/examCycle.routes.js`, `src/routes/lessons.routes.js`, `src/routes/scoreEntry.routes.js`
**Issue:** Route-level middleware only checks `requireAuth` + `requireRole("teacher","admin")`. Instrument-level and student-level access checks live exclusively inside controllers via `assertTeacherCanEdit` / `assertTeacherCanView`. A missed `assert*` call in any new endpoint is a direct BOLA vulnerability.
**Recommendation:** Add a reusable param-level middleware that validates `req.params.studentId` access before reaching the controller, providing defense-in-depth.

### 2.3 MEDIUM — String-Based ID Comparison in `listStudentsForTeacher`

**File:** `src/controllers/teacherStudentAccess.controller.js`
**Issue:** The self-access check (`teacherId !== req.user._id`) compares an ObjectId to a string. Depending on how the JWT payload is normalized, this could silently fail, granting or denying access incorrectly.
**Recommendation:** Use `.toString()` on both sides or `mongoose.Types.ObjectId` equality.

### 2.4 MEDIUM — Parent Access Has No Instrument-Level Filtering

**File:** `src/controllers/parent.controller.js`
**Issue:** Parents see all data for linked students with no instrument-level scoping.
**Risk:** Low today (parents are expected to see everything), but if the access model ever narrows, this becomes over-permissive.

### 2.5 INFO — BOLA/IDOR Protection (Positive)

Commit `b966918` correctly converts 403 → 404 for `getExamCycleById` and `getLessonById`, preventing resource enumeration. This pattern should be applied to every single-resource GET endpoint.

---

## Phase 3: Input Validation & Injection

### 3.1 HIGH — No Per-Field String Length Limits in Controllers

**Files:** All controllers
**Issue:** `express.json({ limit: "10mb" })` caps total body size, but individual fields like `teacherNarrative`, `closingNote`, `withdrawalReason`, and `note` have no controller-level length checks. Some Mongoose schemas enforce `maxlength`, many do not.
**Risk:** Database bloat and resource exhaustion via large text payloads that fit under the 10 MB cap.
**Recommendation:** Add `maxlength` to every string field in Mongoose schemas. Consider adopting Joi or Zod for controller-level request validation.

### 3.2 HIGH — No ObjectId Format Validation on Route Params

**Files:** All controllers consuming `req.params.studentId`, `req.params.cycleId`, `req.params.lessonId`, `req.params.accessId`
**Issue:** An invalid ObjectId string (e.g., `"not-an-id"`) triggers a Mongoose `CastError`, which the global error handler may surface as a 500 instead of a clean 400.
**Recommendation:** Add a shared middleware or helper:

```js
const mongoose = require("mongoose");
function validateObjectId(paramName) {
  return (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    next();
  };
}
```

### 3.3 MEDIUM — No NoSQL Injection Sanitization

**Issue:** Mongoose schema typing provides baseline protection, but `req.query` and `req.body` objects could contain operators like `$gt`, `$ne`, or `$regex` if not explicitly sanitized.
**Recommendation:** Install and apply `express-mongo-sanitize` as global middleware.

### 3.4 MEDIUM — Query Parameter Type Coercion Inconsistencies

**File:** `src/controllers/examCycle.controller.js`, others
**Issue:** Boolean-like query params are compared as `=== "true"` (correct but inconsistent across controllers). No central parsing layer exists.
**Recommendation:** Standardize query param parsing with a validation library or shared utility.

### 3.5 LOW — Inconsistent Bcrypt Cost Factor

**Files:** `src/controllers/auth.controller.js` (cost 12), `src/models/User.js` `setPassword()` (cost 10)
**Issue:** Two different bcrypt costs exist. The model method uses cost 10; the signup controller uses cost 12.
**Recommendation:** Standardize on cost 12. Funnel all hashing through `User.setPassword()` after updating its cost.

---

## Phase 4: Hardening Recommendations

### 4.1 Rate Limiting

| Current State                                  | Recommendation                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Auth routes: 15 req / 15 min                   | Keep                                                               |
| All other routes: **no limit**                 | Add global authenticated limit (100 req/min per user)              |
| Write endpoints (POST/PUT/PATCH): **no limit** | Add stricter limit (20 req/min per user)                           |
| `/api/auth/me` (optionalAuth, no limit)        | Add limit or require auth — can be used for token-validity probing |

### 4.2 Summary Recomputation DoS Vector

**Files:** `src/controllers/lesson.controller.js`, `src/controllers/scoreEntry.controller.js`
**Issue:** Every lesson upsert and score entry creation triggers `recomputeStudentReadModels()`, running multiple MongoDB aggregation queries.
**Risk:** Rapid-fire writes can overload the database with aggregation pipelines.
**Recommendation:** Debounce recomputation or move it to a background job queue (Bull, Agenda).

### 4.3 Secrets Management

| Issue                                   | Severity | Action                                                    |
| --------------------------------------- | -------- | --------------------------------------------------------- |
| MongoDB credentials in `.env` plaintext | CRITICAL | Rotate if ever committed; use secrets manager             |
| JWT fallback `"dev_secret_change_me"`   | CRITICAL | Remove fallback; require `JWT_SECRET` in all environments |
| `JWT_SECRET="some-crazy-random-string"` | HIGH     | Replace with cryptographically random 256-bit key         |

### 4.4 Dependency Hygiene

- **Remove `pg-promise`** — PostgreSQL driver is installed but unused. Unnecessary attack surface.
- **Monitor Express 5.x** — Early release; watch security advisories.
- **Run `npm audit`** regularly.

### 4.5 Logging & Monitoring

- Replace `console.error` with structured logger (Winston/Pino) with environment-aware levels.
- Log failed access-check attempts (403 → 404 conversions) as security events for anomaly detection.
- Add request-ID correlation for audit trail tracing.

### 4.6 Model Hardening

- Apply `toJSON` transforms to all models (currently only `User` has one) to strip `__v` and internal fields.
- Add `maxlength` constraints to all free-text schema fields.
- Validate `endedAt` handling in `access.service.js` — ensure `null` and `undefined` are treated identically.

---

## Findings Summary

| Severity | Count | Key Areas                                                                    |
| -------- | ----- | ---------------------------------------------------------------------------- |
| CRITICAL | 2     | Secrets in `.env`, JWT fallback                                              |
| HIGH     | 4     | Admin granularity, field validation, ObjectId validation, rate limiting gaps |
| MEDIUM   | 4     | NoSQL injection, query parsing, ID comparison types, parent access scope     |
| LOW      | 1     | Bcrypt cost inconsistency                                                    |
| INFO     | 1     | BOLA/IDOR protection (positive)                                              |

## Priority Actions

1. **Immediately:** Rotate MongoDB credentials. Verify `.gitignore` includes `.env`.
2. **This sprint:** Remove JWT secret fallback. Add global rate limiter. Add ObjectId validation middleware. Install `express-mongo-sanitize`.
3. **Next sprint:** Standardize input validation with Joi/Zod. Add `maxlength` to all schemas. Scope admin permissions.
4. **Backlog:** Summary recomputation debouncing. Structured logging. Background job processing.

---

_Generated 2026-03-22 — Automated Security Audit_
