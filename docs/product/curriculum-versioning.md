# Curriculum Versioning

Problem:
Teachers need to choose between ABRSM 2025–2026 and 2027–2028 curriculum during exam cycle creation.

Initial requirement:

- add curriculumVersion to exam cycle
- support multiple ABRSM syllabus versions
- avoid hardcoding future curriculum changes only in frontend files

Open question:
Should syllabus data move from frontend files to database-backed curriculum records?
