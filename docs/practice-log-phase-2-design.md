Implementation order for Phase 2:

1. Load and display saved minutes from tasksByDay.
2. Save minutes entered by parents/students.
3. Add task outcome selector (In Progress, Needs Help, Not Covered).
4. Add optional daily notes per task.
5. Build teacher review workflow and teacher-facing UI.
6. Expose practice data to Student Dashboard.
7. Design analytics layer and future AI insights.

Data collection quality remains the primary goal. Practice Log should continue serving as a structured source of longitudinal student practice data that can support future progress tracking, exam readiness analysis, and AI-assisted recommendations.

Mastery should remain a teacher-reviewed concept rather than a student self-reported outcome.

## Current Status

### Completed

#### Backend Contract

- PracticeLog schema supports:
  - status
  - minutes
  - taskOutcome
  - note
- Added server-side normalization
- Added contract documentation

#### Frontend State Migration

Merged in PR #86

- Migrated Practice Log state from boolean task tracking to structured task records
- Added hydration normalization
- Added save normalization
- Preserved compatibility with future:
  - minutes
  - task outcomes
  - notes

Validated via parent account testing:

- login
- save
- refresh
- hydration

### Next Step

#### Phase 2A — Minutes

Goal:
Allow parents/students to record minutes practiced per task.

Planned work:

1. Display minutes input for practiced tasks
2. Update local state when minutes change
3. Persist minutes via existing save endpoint
4. Hydrate saved minutes from backend
5. Validate minutes range (0–300)
6. Mobile UI review

## Implementation Notes 6/21/2026

Practice Log stores daily records using date keys:

```js
{
  "2026-06-21": {
    pieceA: {
      status: "practiced",
      minutes: 0,
      taskOutcome: "none",
      note: ""
    }
  }
}
```
