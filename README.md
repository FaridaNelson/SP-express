# StudioPulse Backend (SP-express)

Backend API for **StudioPulse** — an ABRSM exam preparation platform that gives teachers, students, and parents a shared, live view of exam readiness after every lesson.

This service provides authentication, student management, lesson tracking, score history, exam preparation workflows, and the readiness-score engine that powers the platform's core value proposition.

---

## Product vision

StudioPulse replaces handwritten mark sheets, spreadsheets, and WhatsApp threads with a structured, data-driven preparation platform. The core concept is the **Triangle of Success**: teacher, student, and parent all share a single live readiness snapshot — updated after every lesson, expressed in the language most useful to each role.

**Readiness target across all features:** 67% = ABRSM pass mark. All score calculations and analytics are relative to this threshold.

---

## Platform roadmap

| Phase | Status        | Scope                                                                                       |
| ----- | ------------- | ------------------------------------------------------------------------------------------- |
| 1     | **Live**      | Teacher, parent, and student dashboards — exam cycles, per-lesson grading, live readiness % |
| 2     | Next release  | School manager layer — teacher effectiveness analytics, cohort readiness                    |
| 3     | Future        | StudioPulse Marketplace — verified teacher discovery by real exam pass rate                 |
| 4     | Future vision | AI + MIDI evaluation — digital keyboard input → objective readiness score                   |

The dataset accumulated in Phase 1 is the defensibility moat: structured, lesson-by-lesson ABRSM grading data that powers every subsequent layer.

---

## Tech Stack

- **Node.js** + **Express 5**
- **MongoDB** + **Mongoose**
- **JWT** — HTTP-only cookie sessions (`sp_jwt`)
- **PM2** — production process manager
- **Nginx** — reverse proxy
- **GCP Secret Manager** — secrets in production
- **Resend** — transactional email (password reset)
- **Jest** + **Supertest** + **MongoMemoryReplSet** — 107 passing tests

---

## Project structure

```
src
├── controllers     # business logic
├── middleware       # auth, roles, error handling
├── models          # Mongoose schemas
├── routes          # Express route definitions
├── utils           # shared helpers (studentAccess.js, tokenUtils.js…)
├── constants       # shared configuration data
├── db.js           # database connection
└── app.js          # server entry point
```

### Design principles

- **Thin routes** — routing only; logic lives in controllers
- **Controllers contain logic** — clean separation of concerns
- **Shared utilities** for repeated access checks (`utils/studentAccess.js`)
- **Centralized error handling** via Express error middleware
- **Consistent auth access** — all authenticated routes read `req.user._id` and `req.user.roles`

---

## Core features

### Authentication

- Signup, login, logout, current session (`GET /api/auth/me`)
- Forgot password / reset password — SHA-256 token hashing, store-hash-send-raw-token pattern
- Email enumeration protection — forgot-password always returns 200
- Rate limiting on all auth routes
- JWT in HTTP-only cookies (`sp_jwt`)

### Exam preparation cycles

The core unit of the platform. Each cycle tracks:

- Student, instrument, exam type (Practical | Performance), grade (1–8)
- Target exam date, pass mark (default 67%)
- Live readiness score calculated from score entries
- Cycle status: `current` → `registered` → `completed` | `withdrawn`

### Per-lesson grading

Structured score entries against ABRSM criteria:

- Pieces (A, B, C) — performance criteria per piece
- Scales, sight-reading, aural training
- Tempo, articulation, pitch accuracy, rhythm accuracy
- Teacher narrative and homework assignment
- All entries feed the live readiness % calculation

### Lesson time suggestion (Phase 1 intelligence)

Based on current readiness scores and weeks to exam, the platform can derive
suggested time allocations across lesson components — weak areas get proportionally
more time. Aural flagged as weak → allocation increases automatically.

### Teacher–student access

- `TeacherStudentAccess` — instrument-specific, role-based access
- `accessRole`: primary | collaborator | viewer
- A student can have multiple instruments, each with independent exam cycles
- Transactions used for `createStudent` and `assignPrimaryTeacher`

### Parent access

- Parents linked to students via secure student-linking flow
- Read-only access: progress reports, homework visibility, exam countdown, teacher notes

### Audit logging

All critical write actions are audit-logged. GDPR-compliant TTL indexes on audit log collection.

---

## Enums (critical — frontend must match exactly)

```
instrument:   Piano | Voice | Guitar
examType:     Practical | Performance
examGrade:    1–8 (integer)
cycleStatus:  current | registered | completed | withdrawn
accessRole:   primary | collaborator | viewer
accessStatus: active | inactive | revoked
```

Planned (Phase 2 — do not add yet):

```
role (future): school_manager
```

---

## Key endpoints

```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

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

---

## Security

- JWT in HTTP-only cookies — no token exposure to JavaScript
- Ownership checks centralized in `utils/studentAccess.js`
- Teachers only access their own students
- Parents only access linked students
- Admin override where necessary
- bcrypt for passwords, SHA-256 for reset tokens
- Rate limiting on auth endpoints
- Soft deletes, GDPR-compliant TTL indexes

---

## Local development

```bash
npm install
npm run dev        # nodemon, auto-reload
```

Server: `http://localhost:4000`

### Environment variables

```
PORT=4000
MONGO_URI=<mongodb connection>
JWT_SECRET=<secure secret>
JWT_DAYS=7
NODE_ENV=development
RESEND_API_KEY=<resend key>
```

Production secrets are managed via GCP Secret Manager.

---

## API health check

```
GET /api/health
→ { "status": "ok" }
```

---

## Production architecture

```
Browser
  │
  ▼
Nginx (reverse proxy)
  │
  ▼
Express API (PM2 — studiopulse-api)
  │
  ▼
MongoDB
```

### Deploy

```bash
cd ~/SP-express
git pull
npm install
pm2 restart studiopulse-api
```

Frontend is served separately by SP-react via Nginx.

---

## Related repository

**SP-react** — React frontend application  
https://github.com/FaridaNelson/SP-react

---

## Contributors

**Farida Nelson**  
Full-Stack Development, Backend Architecture, API Design, System Integration, Users Experience Strategy, Product Logic

**Dilara Swain**  
UX/UI Design, User Experience Strategy, Workflow Design, Product Logic

---

## Author

Farida Nelson  
Software Engineer | Founder – StudioPulse  
https://linkedin.com/in/farida-nelson  
https://studiopulse.co
