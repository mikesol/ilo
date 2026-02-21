# Frozen Koans

These files are immutable validation fixtures for issue #293.

Rules:
- Do not change koan logic.
- If a koan fails, fix `@mvfm/core` instead.
- If a koan appears incorrect, stop and open a `spec-change` issue.

## Gate semantics

The files in `src/__koans__/` are frozen fixtures.

Current `tests/koans/*.test.ts` execute these fixtures directly and are placeholder checks.
They do not yet validate `@mvfm/core` API conformance.

Real gating starts when adapted wrappers import from `@mvfm/core` instead of koan-relative files.
