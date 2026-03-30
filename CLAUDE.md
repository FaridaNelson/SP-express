# StudioPulse Backend — Claude Code Context

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

instrument: Piano | Voice | Guitar
examType: Practical | Performance
examGrade: 1–8 (integer)
cycleStatus: current | registered | completed | withdrawn
accessRole: primary | collaborator | viewer
accessStatus: active | inactive | revoked

## Key endpoints

POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me

POST /api/auth/forgot-password # always 200, sends reset link if email found
POST /api/auth/reset-password # validates token, updates password, clears token

POST /api/students/
GET /api/students/:studentId
PATCH /api/students/:studentId

POST /api/exam-cycles/
GET /api/exam-cycles/student/:studentId
GET /api/exam-cycles/:cycleId
PATCH /api/exam-cycles/:cycleId
POST /api/exam-cycles/:cycleId/complete
POST /api/exam-cycles/:cycleId/withdraw
DELETE /api/exam-cycles/:cycleId
POST /api/exam-cycles/student/:studentId/active/:cycleId

PUT /api/lessons/
GET /api/lessons/student/:studentId
GET /api/lessons/:lessonId

POST /api/score-entries/

GET /api/parent/students
GET /api/parent/students/:id/progress

GET /api/teacher-student-access/teacher/:teacherId/students
POST /api/teacher-student-access/student/:studentId/primary
POST /api/teacher-student-access/student/:studentId/access
POST /api/teacher-student-access/student/:studentId/access/:accessId/revoke

## Auth

Cookie-based: sp_jwt (HTTP-only)
All fetch() calls must use: credentials: 'include'
CORS whitelist: https://studiopulse.co, https://www.studiopulse.co,
http://localhost:3000, http://127.0.0.1:3000

## Local dev

PORT=4000 — npm run dev
