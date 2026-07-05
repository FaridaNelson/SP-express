# StudioPulse Student Marketplace & Game Platform

**Status:** In Development
**Started:** July 2026
**Primary Goal:** Create the first student-facing platform inside StudioPulse that supports interactive learning experiences, educational analytics, and future AI learning systems.

---

# Vision

The Student Marketplace & Game Platform extends StudioPulse beyond lesson management into interactive educational experiences.

The first implementation is **Note Detective**, a standalone educational game that supports:

- guest users using browser local storage,
- authenticated StudioPulse students,
- teacher visibility,
- parent visibility,
- long-term educational analytics,
- future AI-powered learning insights.

---

---

# Core Principle

The Student Marketplace is not limited to games.

It is intended to become the interactive learning layer of StudioPulse and may eventually support:

- educational games
- quizzes
- mock exams
- listening activities
- sight-reading exercises
- audio interactions
- video interactions
- AI-guided exercises
- future educational applications

The first implementation of this platform is **Note Detective**.

---

# MVP Goal

Student logs into StudioPulse
↓
Student opens Note Detective
↓
Student plays game
↓
Game data syncs to MongoDB
↓
Teacher can view results

---

# Architectural Decisions

| Component         | Decision                  |
| ----------------- | ------------------------- |
| Game architecture | Standalone application    |
| Integration       | iframe                    |
| Authentication    | StudioPulse owns auth     |
| Sync              | postMessage + Backend API |
| Persistence       | MongoDB                   |
| Guest storage     | localStorage              |
| Student storage   | MongoDB                   |
| Marketplace       | Single-game MVP first     |

---

# Repository Structure

# Repository Structure

```text
student-marketplace/

├── README.md
├── game-progress-schema-v1.md
├── architecture-decision-record.md
├── note-detective-integration.md
├── session-bridge-protocol.md
├── student-dashboard-spec.md
└── marketplace-roadmap.md
```

---

# Current MVP Scope

### Frontend

- StudentDashboard
- Student routing
- NoteDetectiveHost
- Session bridge

### Backend

- GameProgress model
- Game stats API
- Authorization

### Educational Application

- Note Detective
- Guest mode
- Authenticated mode
- Teacher analytics

---

# Future Interactive Learning Applications

Potential applications include:

### Games

- Note Detective
- Rhythm Detective
- Interval Detective
- Chord Detective
- Scale Detective

### Assessment

- Mock Exams
- Theory Quizzes
- Ear Training

### Interactive Practice

- Sight Reading Trainer
- Technical Exercise Trainer
- Listening Exercises

### AI Experiences

- AI Practice Coach
- Student Learning Agent
- Interactive Music Theory Tutor

---

# Future AI Features

Potential AI capabilities include:

- Long-term educational memory
- Semantic practice search
- Learning pattern recognition
- Skill graph generation
- Personalized recommendations
- Teacher copilot
- Parent copilot
- Student learning agent
- learning cycle awareness
- longitudinal educational memory
- exercise recommendation engine
- personalized learning pathways

---

# Related GitHub Issues

### SP-react

- #85 Student Marketplace MVP
- #98 StudentDashboard
- #99 NoteDetectiveHost
- #100 Session Bridge

### SP-express

- #49 GameProgress Model
- #50 Game Stats API
- #51 Game Authorization

---

# Current Development Phase

**Phase:** Architecture & Data Modeling

Current priorities:

- Architecture Decision Record
- GameProgress Schema v1
- Student Marketplace MVP
- Note Detective integration
