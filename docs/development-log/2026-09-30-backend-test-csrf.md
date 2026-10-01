# Development Log — 2026-09-30

## Backend integration-test recovery

Resumed StudioPulse development and checked the backend test baseline.

Initial result: 7 suites failed, 1 passed; 78 tests failed, 44 passed.
Write requests were rejected by CSRF middleware before reaching the
intended route behavior, causing additional setup-dependent failures.

Added tests/csrf.js to obtain a CSRF token and cookie and attach them
to write requests. Each test receives fresh CSRF credentials;
authentication remains explicit.

Migrated seven test suites, strengthened setup-write and null assertions,
and corrected the score-entry audit expectation to UPSERT_SCORE_ENTRY.

Added rejection tests for missing tokens, invalid tokens, and
mismatched token/cookie pairs. Each asserts the CSRF error message.

## Validation

- Full suite passed on the VM and Mac: 8 suites, 125 tests.
- Final Mac rerun passed after review improvements.
- git diff --check passed.
- Production code and dependency files unchanged.

Implementation commit: e43f708.
Branch: fix/backend-test-csrf.

## Remaining work

Backend #60 remains separate and unresolved by this test-only change.
Note Detective authorization and session-bridge work remain pending.
No production deployment is required.
