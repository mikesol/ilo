# Issue #72 Monorepo Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert ilo from a single package into a pnpm monorepo with `@mvfm/core` plus 13 independently publishable `@mvfm/plugin-*` packages.

**Architecture:** Move source code into package-owned directories, keep foundational plugins in core, and split external-service plugins into standalone packages that depend on `@mvfm/core` and their own SDK dependencies. Wire shared build/check/test through pnpm recursive scripts, TypeScript project references, and CI updates to validate transitive dependency trees.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Biome, API Extractor, GitHub Actions, Changesets.

---

### Task 1: Establish pnpm workspace scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write the failing test**
- Add a temporary CI/workflow command expectation by running recursive pnpm commands before workspace files exist.

**Step 2: Run test to verify it fails**
Run: `pnpm -r build`
Expected: FAIL due to missing workspace configuration.

**Step 3: Write minimal implementation**
- Add `pnpm-workspace.yaml` with `packages/*`.
- Update root scripts to recursive workspace invocations.
- Switch CI install/cache and commands to pnpm recursive form.

**Step 4: Run test to verify it passes**
Run: `pnpm -r build`
Expected: command resolves workspace packages (may still fail until later tasks add packages).

**Step 5: Commit**
```bash
git add pnpm-workspace.yaml package.json .github/workflows/ci.yml
git commit -m "build: add pnpm workspace scaffolding"
```

### Task 2: Create `@mvfm/core` package and move foundational source

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/*` (moved from root `src/*`)
- Modify: `tsconfig.json`
- Modify: `api-extractor.json` (or package-local extractor config)

**Step 1: Write the failing test**
- Add/adjust one core test import to `@mvfm/core`.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @mvfm/core test`
Expected: FAIL due to unresolved package entry.

**Step 3: Write minimal implementation**
- Move core runtime + foundational plugins into `packages/core/src`.
- Set package name to `@mvfm/core`.
- Add exports/types/main for compiled output.
- Ensure public exports include only core + foundational plugins.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @mvfm/core test`
Expected: PASS for core package tests (integration skips acceptable in sandbox).

**Step 5: Commit**
```bash
git add packages/core tsconfig.json api-extractor.json
git commit -m "refactor(core): move core into @mvfm/core package"
```

### Task 3: Split plugin package `@mvfm/plugin-postgres`

**Files:**
- Create: `packages/plugin-postgres/package.json`
- Create: `packages/plugin-postgres/tsconfig.json`
- Create: `packages/plugin-postgres/src/*`
- Modify: `packages/core/src/index.ts`
- Modify: relevant tests under `tests/plugins/postgres/**`

**Step 1: Write the failing test**
- Update one postgres plugin test import to `@mvfm/plugin-postgres`.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @mvfm/plugin-postgres test`
Expected: FAIL due to missing package/export.

**Step 3: Write minimal implementation**
- Move postgres plugin code into package source.
- Add `@mvfm/core` and `postgres` dependencies.
- Remove postgres exports from core public API.

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @mvfm/plugin-postgres test`
Expected: PASS or expected integration skips.

**Step 5: Commit**
```bash
git add packages/plugin-postgres packages/core/src/index.ts tests/plugins/postgres
git commit -m "refactor(plugin): split postgres package"
```

### Task 4: Split plugin packages `@mvfm/plugin-stripe`, `@mvfm/plugin-openai`, `@mvfm/plugin-anthropic`, `@mvfm/plugin-resend`

**Files:**
- Create: `packages/plugin-stripe/**`
- Create: `packages/plugin-openai/**`
- Create: `packages/plugin-anthropic/**`
- Create: `packages/plugin-resend/**`
- Modify: package-local tests/import paths
- Modify: `packages/core/src/index.ts`

**Step 1: Write the failing test**
- For each plugin, switch one test import to new package name.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @mvfm/plugin-stripe test && pnpm --filter @mvfm/plugin-openai test && pnpm --filter @mvfm/plugin-anthropic test && pnpm --filter @mvfm/plugin-resend test`
Expected: FAIL until package entrypoints are created.

**Step 3: Write minimal implementation**
- Move source per plugin.
- Add SDK dependencies (`stripe`, `openai`, `@anthropic-ai/sdk`, `resend`).
- Ensure exports map includes plugin main + handlers + interpreter + wrappers.
- Remove exports from core.

**Step 4: Run test to verify it passes**
Run: same command as Step 2.
Expected: PASS or expected integration skips.

**Step 5: Commit**
```bash
git add packages/plugin-stripe packages/plugin-openai packages/plugin-anthropic packages/plugin-resend packages/core/src/index.ts tests/plugins/{stripe,openai,anthropic,resend}
git commit -m "refactor(plugin): split stripe/openai/anthropic/resend packages"
```

### Task 5: Split plugin packages `@mvfm/plugin-redis`, `@mvfm/plugin-s3`, `@mvfm/plugin-slack`, `@mvfm/plugin-twilio`

**Files:**
- Create: `packages/plugin-redis/**`
- Create: `packages/plugin-s3/**`
- Create: `packages/plugin-slack/**`
- Create: `packages/plugin-twilio/**`
- Modify: package-local tests/import paths
- Modify: `packages/core/src/index.ts`

**Step 1: Write the failing test**
- For each plugin, switch one test import to new package name.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @mvfm/plugin-redis test && pnpm --filter @mvfm/plugin-s3 test && pnpm --filter @mvfm/plugin-slack test && pnpm --filter @mvfm/plugin-twilio test`
Expected: FAIL until package code exists.

**Step 3: Write minimal implementation**
- Move plugin sources.
- Add SDK dependencies (`ioredis`/redis adapter usage, `@aws-sdk/client-s3`, `@slack/web-api`, `twilio`).
- Remove exports from core.

**Step 4: Run test to verify it passes**
Run: same command as Step 2.
Expected: PASS or expected integration skips.

**Step 5: Commit**
```bash
git add packages/plugin-redis packages/plugin-s3 packages/plugin-slack packages/plugin-twilio packages/core/src/index.ts tests/plugins/{redis,s3,slack,twilio}
git commit -m "refactor(plugin): split redis/s3/slack/twilio packages"
```

### Task 6: Split plugin packages `@mvfm/plugin-fal`, `@mvfm/plugin-fetch`, `@mvfm/plugin-cloudflare-kv`, `@mvfm/plugin-pino`

**Files:**
- Create: `packages/plugin-fal/**`
- Create: `packages/plugin-fetch/**`
- Create: `packages/plugin-cloudflare-kv/**`
- Create: `packages/plugin-pino/**`
- Modify: package-local tests/import paths
- Modify: `packages/core/src/index.ts`

**Step 1: Write the failing test**
- For each plugin, switch one test import to new package name.

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @mvfm/plugin-fal test && pnpm --filter @mvfm/plugin-fetch test && pnpm --filter @mvfm/plugin-cloudflare-kv test && pnpm --filter @mvfm/plugin-pino test`
Expected: FAIL until package entrypoints exist.

**Step 3: Write minimal implementation**
- Move plugin sources.
- Add SDK dependencies (`@fal-ai/client`, runtime fetch assumptions, Cloudflare KV typing, `pino`).
- Remove exports from core.

**Step 4: Run test to verify it passes**
Run: same command as Step 2.
Expected: PASS or expected integration skips.

**Step 5: Commit**
```bash
git add packages/plugin-fal packages/plugin-fetch packages/plugin-cloudflare-kv packages/plugin-pino packages/core/src/index.ts tests/plugins/{fal,fetch,cloudflare-kv,pino}
git commit -m "refactor(plugin): split fal/fetch/cloudflare-kv/pino packages"
```

### Task 7: Convert tests and root tooling to package-aware imports

**Files:**
- Modify: `tests/**/*.ts`
- Modify: root/shared Vitest config files (if present)
- Modify: `package.json`

**Step 1: Write the failing test**
- Convert a representative cross-plugin test to package imports.

**Step 2: Run test to verify it fails**
Run: `pnpm -r test`
Expected: FAIL on unresolved legacy paths/imports.

**Step 3: Write minimal implementation**
- Update all tests to import from package names.
- Ensure test scripts execute in package context.

**Step 4: Run test to verify it passes**
Run: `pnpm -r test`
Expected: PASS with known sandbox integration limitations.

**Step 5: Commit**
```bash
git add tests package.json
git commit -m "test: migrate suite to package imports"
```

### Task 8: Add coordinated release support and package publish metadata

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/*.md` (initial release notes)
- Modify: each `packages/*/package.json`
- Modify: root release scripts/config

**Step 1: Write the failing test**
- Validate missing changeset command in current setup.

**Step 2: Run test to verify it fails**
Run: `pnpm changeset status`
Expected: FAIL before Changesets configuration.

**Step 3: Write minimal implementation**
- Add Changesets config and release scripts.
- Ensure all packages have publish metadata (`name`, `version`, `files`, `exports`, `types`).

**Step 4: Run test to verify it passes**
Run: `pnpm changeset status`
Expected: PASS and reports release plan state.

**Step 5: Commit**
```bash
git add .changeset packages package.json
git commit -m "chore(release): add changesets for workspace packages"
```

### Task 9: Full verification and docs updates

**Files:**
- Modify: `AGENTS.md`/`CLAUDE.md` if workflow commands changed
- Modify: docs for install/import examples (if present)
- Modify: `.github/workflows/ci.yml` (final verification)

**Step 1: Write the failing test**
- Run full workspace validation before final docs fixes.

**Step 2: Run test to verify it fails**
Run: `pnpm -r build && pnpm -r check && pnpm -r test`
Expected: expose any remaining path/config mismatch.

**Step 3: Write minimal implementation**
- Fix final workspace/doc/CI inconsistencies.

**Step 4: Run test to verify it passes**
Run: `pnpm -r build && pnpm -r check && pnpm -r test`
Expected: workspace passes (except environment-restricted integrations where explicitly skipped/guarded).

**Step 5: Commit**
```bash
git add -A
git commit -m "chore: finalize monorepo split and workspace verification"
```

