Lifecycle:
current
→ registered
→ awaiting_results
→ completed

current/registered
→ withdrawn

Active invariant:
0..1 active cycle per student + instrument
active = current | registered

Historical:
creation mode, not status

Dates:
cycleStartDate = real beginning of preparation
createdAt = system/audit time

Results:
awaiting_results → Add Exam Results
manual/PDF
one normal final submission
→ completed

Historical lesson boundary:
cycleStartDate ≤ lessonDate ≤ examDate
