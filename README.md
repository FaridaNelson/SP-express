# StudioPulse Backend (SP-express)

Backend API for **StudioPulse**, a music teaching studio management platform that helps teachers track student progress, lessons, and exam preparation.

This service provides authentication, student management, lesson tracking, score history, and exam preparation workflows.

---

## Tech Stack

- Node.js
- Express
- MongoDB
- Mongoose
- JWT Authentication
- Cookie-based sessions
- PM2 (production process manager)
- Nginx (reverse proxy)

---

## Project Architecture

The backend follows a modular structure separating routing, business logic, and data models.

src
├ controllers # business logic
├ middleware # auth, roles, error handling
├ models # Mongoose schemas
├ routes # Express route definitions
├ utils # shared helpers
├ constants # shared configuration data
├ db.js # database connection
└ app.js # server entry point

### Design Principles

- **Thin routes**
- **Controllers contain logic**
- **Shared utilities for repeated checks**
- **Centralized error handling**
- **Consistent authentication access**

Authenticated requests use:

req.user.\_id
req.user.roles

---

## Core Features

### Authentication

- signup
- login
- logout
- current user session (`/api/auth/me`)

Authentication uses **JWT stored in HTTP-only cookies**.

---

### Teachers

Teachers can:

- create students
- manage student progress
- record lessons
- record score history
- manage exam preparation cycles

---

### Parents

Parents can:

- view linked student progress
- access progress data through secure student linking

---

### Lessons

Teachers can record:

- pieces
- scales
- sight reading
- aural training
- teacher narrative

Lessons are upserted by:

teacherId + studentId + lessonDate

---

### Score Tracking

Score entries track progress history including:

- performance criteria
- tempo
- articulation
- pitch accuracy
- rhythm accuracy
- exam elements

Scores support pagination for history views.

---

### Exam Preparation Cycles

Exam cycles manage preparation for ABRSM exams.

Supported exam types:

- Practical
- Performance

---

## Security

Access control ensures:

- teachers only access their students
- parents only access linked students
- admin override where necessary

Ownership checks are centralized in:

utils/studentAccess.js

---

## Local Development

### Install dependencies

npm install

### Start development server

npm run dev

Server runs with **nodemon** for automatic reload.

---

## Environment Variables

Create `.env` file:

PORT=4000
MONGO_URI=<mongodb connection>
JWT_SECRET=<secure secret>
JWT_DAYS=7
NODE_ENV=development

---

## API Health Check

GET /api/health

Response:

{
"status": "ok"
}

---

## Deployment

Production runs on a Linux VM.

Backend process is managed by **PM2**.

### Deploy steps

cd ~/SP-express
git pull
npm install
pm2 restart studiopulse-api

---

## Production Architecture

Browser
│
▼
Nginx
│
▼
Express API
│
▼
MongoDB

Frontend is served separately by **SP-react**.

---

## Related Repository

Frontend:

SP-react

React application providing the StudioPulse UI.

---

## Author

Farida Nelson  
Founder – StudioPulse

## Contributors

**Farida Nelson**  
Full-Stack Development, Backend Architecture, API Design, System Integration, Product Logic

**Dilara Swain**  
UX/UI Design, User Experience Strategy, and Workflow Design

StudioPulse is being developed collaboratively, combining software engineering and user-centered design to build a practical platform for music studios.
