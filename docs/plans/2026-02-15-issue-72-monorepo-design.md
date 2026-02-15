# Issue #72 Monorepo Packaging Design

## Context
Issue #72 requires converting the repository into a publishable monorepo using scoped packages under `@mvfm`, keeping foundational language plugins in core and splitting vendored/external-service plugins into independent packages.

## Scope Decisions
- Implement all 13 external plugin packages in this PR.
- Do not include an aggregate convenience package.
- Use regular package `dependencies` for third-party SDKs.
- Prefer idiomatic package-native layout over compatibility shims.
- Use pnpm workspaces (not npm workspaces).

## Section 1: Workspace Architecture
- Introduce pnpm workspace configuration at repository root.
- Create `packages/core` for `@mvfm/core`.
- Create independent packages:
  - `@mvfm/plugin-postgres`
  - `@mvfm/plugin-stripe`
  - `@mvfm/plugin-openai`
  - `@mvfm/plugin-anthropic`
  - `@mvfm/plugin-resend`
  - `@mvfm/plugin-redis`
  - `@mvfm/plugin-s3`
  - `@mvfm/plugin-slack`
  - `@mvfm/plugin-twilio`
  - `@mvfm/plugin-fal`
  - `@mvfm/plugin-fetch`
  - `@mvfm/plugin-cloudflare-kv`
  - `@mvfm/plugin-pino`
- Keep foundational plugins in `@mvfm/core`:
  - num
  - str
  - eq
  - ord
  - semiring
  - semigroup
  - monoid
  - show
  - boolean
  - control
  - st
  - bounded
  - heyting-algebra
  - error
  - fiber

## Section 2: Fully Package-Native Source Layout
- Physically move source into package-owned trees.
- Core-only exports live in `@mvfm/core`.
- External-service plugin public APIs live in `@mvfm/plugin-*` packages.
- Plugin packages import core contracts/types only via `@mvfm/core`.
- Root becomes orchestration-only (workspace config, shared scripts, CI, release tooling).
- Preserve plugin contract and AST naming conventions.

## Section 3: Build, Test, CI, and Release
- Use recursive pnpm workspace scripts for build/test/check.
- Use TypeScript project references for cross-package dependency ordering.
- Keep shared lint/type policy at root, with package tsconfigs extending base config.
- Run CI across workspace packages so core changes validate dependents.
- Add coordinated release automation with Changesets for lockstep version bumps.

## Risks and Mitigations
- Risk: path/import breakage during package extraction.
  - Mitigation: perform package-by-package migration and run targeted tests per package.
- Risk: CI and local developer workflow churn due to pnpm switch.
  - Mitigation: update scripts/docs/workflows in one change and validate with root check commands.
- Risk: accidental re-export drift across package boundaries.
  - Mitigation: explicitly define each package `exports` map and validate public API generation.

## Out of Scope
- Aggregate `@mvfm/plugins` package.
- Backward-compatibility compatibility shims for the old single-package API.

