# External Plugin PR Checklist

Use this checklist for every external-service plugin PR. This is required evidence, not optional process.

## PR Metadata

- PR number/title:
- Plugin package (for example `@mvfm/plugin-openai`):
- Upstream SDK/service and exact target version:
- `Closes #<issue>`:

## 1) Source-Clone Evidence (Step 0 Hard Gate)

- [ ] Cloned upstream source at exact target version into `/tmp`
- [ ] Recorded clone path:
- [ ] Recorded version tag/ref:
- [ ] Recorded commit hash (`git rev-parse --short HEAD`):
- [ ] Recorded primary source files inspected:

If clone/source analysis failed at any point:
- [ ] Implementation stopped (no code changes merged)
- [ ] Failure reason documented

## 2) API Parity and Deviations

Default expectation: 1:1 syntax/signature parity with upstream SDK/spec.

- [ ] Confirmed no ergonomic redesigns
- [ ] Added parity/deviation table

| Upstream API | MVFM API | Parity? | If no, exact mismatch | Why parity was impossible |
|---|---|---|---|---|
| | | | | |

- [ ] Every deviation documented in plugin header comments
- [ ] Every deviation documented in PR body/checklist

## 3) Integration Test Class and Rationale

Choose one (highest feasible fidelity required):
- [ ] Real service in CI with required secrets/tokens
- [ ] Official vendor mock/container
- [ ] High-fidelity fixtures from real API behavior
- [ ] Synthetic stubs (exceptional; must justify)

Required notes:
- [ ] Integration tests exist (`integration.test.ts` or justified equivalent)
- [ ] If real-service tests are required, CI secrets are present
- [ ] If fixtures are used, provenance is documented (capture source/method/date)
- [ ] If synthetic stubs are used, explicit exception rationale is documented

## 4) Type-Parity Verification

- [ ] Interpreter/client-facing return types match upstream shapes where possible
- [ ] No unnecessary broadening to `Record<string, unknown>`/`unknown`
- [ ] Any unavoidable type weakening documented with exact mismatch
- [ ] SDK request/response types reused directly where possible

## 5) Package, CI, and Export Surface Verification

- [ ] Plugin lives in `@mvfm/plugin-*` package
- [ ] CI scope verified:
- [ ] Plugin package tests run when package changes
- [ ] Plugin package tests run when core/runtime changes affect plugins
- [ ] Central export surface verified for intended public exposure

## 6) Lifecycle Stage and Honest Assessment

- [ ] Plugin header includes implementation status (`COMPLETE` or `PARTIAL`)
- [ ] Plugin header includes plugin size classification (`SMALL`/`MEDIUM`/`LARGE`)
- [ ] Honest assessment section included (`WORKS GREAT`, `WORKS BUT DIFFERENT`, `DOESN'T WORK/HARD`, `SUMMARY`)
- [ ] Current lifecycle status is stated honestly (size/pass status, known gaps)

## 7) Validation Evidence

Record exact commands and outcomes:

- Build:
- Check:
- Test:
- Integration test command(s):

If any command failed:
- Failure details:
- Why failure is unrelated (if claiming unrelated):
