# Issue 86: Slack Plugin — Replace Generic Record Typing with @slack/web-api Types

## Problem

All 25 methods in `SlackMethods` use `Record<string, unknown>` for params and returns, providing no compile-time validation of Slack API parameters or responses.

## Decision

Replace `Record<string, unknown>` with direct imports from `@slack/web-api`.

## Approach

**Utility types:**

- `Exprify<T>` — recursively maps each field to `T[K] | Expr<T[K]>`, matching the pattern used by plugin-fal. Allows mixed plain/Expr values in param objects.
- `SlackParams<T> = Exprify<Omit<T, 'token'>>` — strips the `token` field (MVFM manages tokens via `SlackConfig`) and applies `Exprify`.

**User-facing changes (types.ts):**

Import all 25 `*Arguments` and 25 `*Response` types from `@slack/web-api`. Replace each method signature:

```typescript
// Before
postMessage(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>

// After
postMessage(params: SlackParams<ChatPostMessageArguments>): Expr<ChatPostMessageResponse>
```

Note: `Exprify` already allows `Expr<T>` at the top level (object branch returns `{ [K in keyof T]: Exprify<T[K]> } | Expr<T>`), so the explicit `Expr<...> |` union in the param type is no longer needed.

**Internal plumbing (build-methods.ts):**

Make `resolveParams` accept `unknown` since params are now typed at the interface level and `ctx.lift` handles any value.

**No changes to:** `interpreter.ts`, `client-slack-web-api.ts`, `node-kinds.ts`, `index.ts`.

## Deviation notes

- `token` stripped from argument types — MVFM-imposed constraint (tokens managed via `SlackConfig`).
- Internal interpreter stays generic — MVFM uses string-based node dispatch, per-method typing at the interpreter level adds complexity without user-facing benefit.

## Validation

- `npm run build` — type-checks all packages
- `npm run check` — linting
- `npm test` — existing tests pass with new types
