# Practice Log Phase 2 Backend Contract

## Goal

Practice Log Phase 2 expands practice tracking from simple task completion to structured weekly practice data.

The backend must support:

- minutes practiced per task per day
- parent/student self-reported task outcome
- optional notes
- teacher review later
- future analytics and AI summaries

---

## API Endpoints

### GET /api/parent/students/:id/practice-log

Returns the practice log for a student and week.

### POST /api/parent/students/:id/practice-log

Creates or updates the practice log for a student and week.

---

## Request Body

```js
{
  examCycleId: "string",
  weekStartDate: "YYYY-MM-DD",
  weekEndDate: "YYYY-MM-DD",
  homeworkTaskList: {
    pieceA: {
      daysPracticed: 2,
      streak: 1,
      lastPracticedDate: "YYYY-MM-DD",
      totalMinutes: 45
    }
  },
  tasksByDay: {
    Sunday: {
      pieceA: {
        status: "practiced",
        minutes: 20,
        taskOutcome: "inProgress",
        note: "Worked on bars 12-16 slowly."
      }
    }
  }
}
```

## Production Notes

Current production data uses date-keyed tasksByDay records.

Backend normalization must accept:

YYYY-MM-DD

Example:

2026-06-21
2026-06-22
2026-06-23
