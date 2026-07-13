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

# Design Philosophy

StudioPulse provides the educational platform.

Educational applications remain independent products that can:

- run standalone,
- integrate with StudioPulse,
- evolve independently,
- be distributed outside the StudioPulse ecosystem.

StudioPulse provides identity, persistence, and educational analytics rather than owning the implementation of each application.

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

| Component                | Decision                   |
| ------------------------ | -------------------------- |
| Educational applications | Independent repositories   |
| Game architecture        | Standalone web application |
| Host                     | StudioPulse (`SP-react`)   |
| Authentication           | StudioPulse owns identity  |
| Integration              | iframe + postMessage       |
| Persistence              | GameProgress API           |
| Student storage          | MongoDB                    |
| Guest storage            | localStorage               |

---

# System Architecture

```text
Student
    │
    ▼
SP-react
(Student Dashboard / Host)
    │
    │ iframe
    ▼
note-detective
(Standalone Game)
    │
    │ postMessage
    ▼
SP-react
(Session Bridge)
    │
    │ authenticated API
    ▼
SP-express
(GameProgress API)
    │
    ▼
MongoDB
```

The standalone application never communicates directly with the backend.
All authenticated persistence flows through the StudioPulse host layer.

---

## Current MVP Scope

### SP-react

- Student Dashboard
- Student routing
- Marketplace
- NoteDetectiveHost

### SP-express

- GameProgress model
- Session API
- Authorization

### note-detective

- Standalone game
- Guest mode
- Messaging interface

<!-- ### Educational Application

- Note Detective
- Guest mode
- Authenticated mode
- Teacher analytics -->

---

# Platform Ownership

## StudioPulse Platform

- authentication
- student management
- teacher management
- parent management
- analytics
- GameProgress persistence

## Educational Applications

- Note Detective
- future educational tools

Educational applications remain independently deployable while integrating with StudioPulse through a documented messaging protocol.

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

### Interactive Practice Tools

- Sight Reading Trainer
- Technical Exercise Trainer
- Listening Exercises

### AI Learning Experiences

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

**Phase:** Marketplace Foundation

### Completed

- Marketplace architecture
- GameProgress API
- Student Dashboard
- Student Marketplace routing
- Standalone Note Detective repository

### Current

- Note Detective application
- Host integration
- Session bridge

---

# Long-Term Vision

The Student Marketplace is designed to support multiple independently developed educational applications that share a common StudioPulse platform for authentication, analytics, persistence, and AI-assisted learning.

As additional applications are introduced, they will integrate through the same host and messaging architecture established by Note Detective.
