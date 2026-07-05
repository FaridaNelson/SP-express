# GameProgress Schema v1

**Status:** Draft  
**Issue:** SP-express #49  
**Date:** 2026-07-05

---

# Goal

Design a generalized persistence model for interactive learning activity in StudioPulse.

This should support:

- learning cycle integration
- Note Detective MVP
- games
- quizzes
- mock exams
- audio/video interactions
- student analytics
- teacher analytics
- parent visibility
- future AI memory
- future educational marketplace applications

---

# Core Concept

`GameProgress` may eventually become part of a broader `InteractiveLearningProgress` system.

Interactive learning includes:

- games
- quizzes
- mock exams
- listening activities
- sight-reading activities
- audio interactions
- video interactions
- AI-guided exercises

For v1, we will start with `GameProgress`, but the schema should not be limited only to games.

---

# Entity Definition

One `GameProgress` document represents:

```text
one student
        +
one educational application
        +
historical interaction data
```

### Unique key

```text
studentId + appId
```

### Possible future keys

```text
studentId + appId + moduleId
studentId + appId + unitId
studentId + appId + learningCycleId
```

---

# Student / App Information

```js
{
  (studentId,
    appId,
    appType, // game | quiz | mockExam | audio | video | aiExercise
    learningCycleId,
    moduleId,
    unitId,
    createdAt,
    updatedAt);
}
```

---

# Save Strategy

Live gameplay should save locally first.

MongoDB should be updated when:

- timed session ends
- student clicks **Stop & See Results**
- student closes/refreshes page, if possible
- student resets history

```text
localStorage = live gameplay memory
MongoDB = completed session memory
```

Do not store every individual click in MongoDB for v1.

---

# Session History

### Open question

Should we store every completed session?

### Recommended v1

Yes, store session summaries, not raw event streams.

```js
sessions: [
  {
    score,
    correct,
    incorrect,
    duration,
    mode, // practice | timed
    timerMinutes, // 0 | 1 | 2 | 5
    endedBy, // student | timer | pagehide
    completedAt,
  },
];
```

---

# Cumulative Statistics

For Note Detective:

```js
cumulativeStats: {
  C4: {
    seen: 50,
    wrong: 12
  },

  D4: {
    seen: 41,
    wrong: 2
  }
}
```

### Open question

Is this sufficient for teachers, or do we also need:

- difficulty level
- clef
- range
- accidental context

---

# Reset Behavior

Reset should clear the active visible stats, but should not erase the long-term learning record.

### Recommended v1

```js
resetHistory: [
  {
    resetAt,
    resetBy,
    reason,
  },
];
```

### Future option

Archive the previous cumulative stats before reset.

```js
archives: [
  {
    archivedAt,
    reason: "student_reset",
    cumulativeStatsBeforeReset,
  },
];
```

---

# Teacher Analytics Requirements

Teachers may want to see:

- most missed notes
- accuracy percentage
- improvement over time
- practice frequency
- weak areas
- strong areas
- session history
- suggested exercises based on weak areas

### Important note

Weak areas should eventually help generate or recommend future exercises.

---

# Student Analytics Requirements

Students may want to see:

- best score
- total sessions
- longest streak
- accuracy
- personal records
- progress graphs
- achievements

---

# Parent Analytics Requirements

Parents may want to see:

- time spent per day
- practice frequency
- improvement trends
- current level
- areas needing attention

---

# Future AI Requirements

AI systems may require:

- timestamped sessions
- error patterns
- learning curves
- practice habits
- skill mastery
- temporal trends
- cross-game relationships
- links to learning cycles
- links to teacher-assigned goals

---

# Future Marketplace Support

The schema should support:

- Note Detective
- Rhythm Detective
- Interval Detective
- Chord Detective
- Scale Detective
- Sight Reading
- Ear Training
- Technique Trainer
- quizzes
- mock exams
- audio/video learning modules
