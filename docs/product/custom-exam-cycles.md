# Custom Exam Cycles

Goal:
Support non-ABRSM and flexible teacher-defined exam cycles.

Teacher should be able to choose:

- pieces only
- pieces + scales
- pieces + sight-reading
- pieces + aural training
- custom category combination

This expands StudioPulse beyond ABRSM-only students.

## Lesson Metadata (June 2026)

Each performance piece now stores additional lesson-specific metadata:

- tempoNoteValue
  - quarter
  - dottedQuarter
  - eighth

- goalTempo
- currentTempo

- minutesInClass
- homework

This metadata is stored inside each lesson record rather than inside the ExamPreparationCycle because it changes every lesson.

These fields are intended for:

- Parent Dashboard
- future tempo analytics
- future AI practice recommendations
- teacher progress tracking
