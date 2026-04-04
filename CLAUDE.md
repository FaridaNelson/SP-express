# StudioPulse Backend — Claude Code Context

## Product vision (summary)

StudioPulse is an ABRSM exam-preparation platform with a four-phase roadmap.
Every layer of the product draws on the structured lesson-by-lesson dataset
accumulated in Phase 1 — the data flywheel is the core defensibility moat.

**Readiness target across all phases:** 67% = ABRSM pass mark.
All score entries, readiness calculations, and analytics must be relative to
this threshold.

## Platform roadmap (data / backend implications)

| Phase | Status        | Backend scope                                                                |
| ----- | ------------- | ---------------------------------------------------------------------------- |
| 1     | Live now      | Teacher/student/parent dashboards, exam cycles, lessons, score entries       |
| 2     | Next release  | School manager account type, teacher-effectiveness analytics, cohort queries |
| 3     | Future        | Marketplace service — public teacher profiles, verified pass-rate rankings   |
| 4     | Future vision | MIDI ingestion API, AI performance model, objective readiness score          |

### Phase 2 — School manager layer (design ahead for this)

New user role: `school_manager` sitting above teachers in a school account.
Key data needs:

- Aggregate pass rates per teacher
- Per-teacher, per-skill-area performance breakdown (pieces / scales / sight-reading / aural)
- CPD/training flags derived from persistent weakness patterns
- Cohort-level readiness snapshots across all students in a school

Plan for a `School` collection and `SchoolTeacherAccess` junction when
designing Phase 2 migrations. Do not add the role to enums prematurely —
document the planned enum value here:
`role (future): school_manager`

### Phase 3 — Marketplace (separate service)

Public-facing read API: teacher profiles, verified pass rates, review system.
Reviews restricted to parents of active students (enforce at API level).
No write-back to core platform — marketplace reads anonymised aggregate data only.

### Phase 4 — AI + MIDI (future)

New ingestion surface: MIDI event streams from digital keyboards.
Per-event data: note, timestamp, velocity, duration.
AI model input: MIDI session + ABRSM criteria + historical ScoreEntry data.
Output: independent `midiReadinessScore` alongside teacher `readinessScore`.
Plan for a `MidiSession` collection and a `PerformanceEvaluation` collection.

---

## Stack

Node.js + Express 5 + MongoDB/Mongoose + JWT (HTTP-only cookies)

## Current state (March 2026)

- 107 passing tests — Jest + Supertest + MongoMemoryReplSet
- Security hardened — see SECURITY_REPORT.md and FIXES_APPLIED.md
- Secrets: GCP Secret Manager in production, .env in dev/test
- Admin scoped permissions: deferred (next sprint)

## Architecture

- Standalone student model — not owned by teacher document
- Instrument-specific access via TeacherStudentAccess
- Roles: admin, teacher, parent (student role exists, not active)
- Audit logs on all critical write actions
- Read models: StudentDashboardSummary, ExamPreparationCycle.progressSummary
- Transactions used for: createStudent, assignPrimaryTeacher

## Multi-instrument support (designed in, UI pending)

- A student can have multiple instruments (e.g. Piano + Guitar)
- Each instrument has independent ExamPreparationCycles
- TeacherStudentAccess is instrument-specific — a teacher can have
  different roles per instrument
- Student.instrument = primary instrument (set at creation)
- Additional instruments added via new ExamCycles on a different instrument
- UI for adding a second instrument = Phase C sprint

## Enums (critical — frontend must match these exactly)

```
instrument:   Piano | Voice | Guitar
examType:     Practical | Performance
examGrade:    1–8 (integer)
cycleStatus:  current | registered | completed | withdrawn
accessRole:   primary | collaborator | viewer
accessStatus: active | inactive | revoked
```

Planned (Phase 2, do not add yet):

```
role (future): school_manager
```

## Key endpoints

```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

POST /api/auth/forgot-password  # always 200, sends reset link if email found
POST /api/auth/reset-password   # validates token, updates password, clears token

POST  /api/students/
GET   /api/students/:studentId
PATCH /api/students/:studentId

POST   /api/exam-cycles/
GET    /api/exam-cycles/student/:studentId
GET    /api/exam-cycles/:cycleId
PATCH  /api/exam-cycles/:cycleId
POST   /api/exam-cycles/:cycleId/complete
POST   /api/exam-cycles/:cycleId/withdraw
DELETE /api/exam-cycles/:cycleId
POST   /api/exam-cycles/student/:studentId/active/:cycleId

PUT /api/lessons/
GET /api/lessons/student/:studentId
GET /api/lessons/:lessonId

POST /api/score-entries/

GET /api/parent/students
GET /api/parent/students/:id/progress

GET  /api/teacher-student-access/teacher/:teacherId/students
POST /api/teacher-student-access/student/:studentId/primary
POST /api/teacher-student-access/student/:studentId/access
POST /api/teacher-student-access/student/:studentId/access/:accessId/revoke
```

## Auth

Cookie-based: `sp_jwt` (HTTP-only)
All fetch() calls must use: `credentials: 'include'`
CORS whitelist: https://studiopulse.co, https://www.studiopulse.co,
http://localhost:3000, http://127.0.0.1:3000

## Security patterns

- store-hash-send-raw-token pattern for password reset tokens (SHA-256)
- always-200 on forgot-password (email enumeration protection)
- Rate limiting on auth routes
- bcrypt for passwords, JWT in HTTP-only cookies
- Role-based middleware, soft deletes, GDPR-compliant TTL indexes on audit logs

## Local dev

PORT=4000 — `npm run dev`
