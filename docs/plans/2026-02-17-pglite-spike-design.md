# PGLite Spike Design

## Goal

Validate that PGLite (in-browser Postgres via WASM) can run real SQL queries through the mvfm postgres plugin in the docs playground. Single standalone page, not integrated into the example system.

## Motivation

The postgres plugin's mock interpreter would return hardcoded data — users can't INSERT then SELECT and see results, can't demo transactions, can't edit queries. PGLite gives a real SQL engine in the browser, making examples genuinely interactive.

## Components

### 1. `wrapPgLite(db)` adapter

**File:** `packages/docs/src/pglite-adapter.ts`

Implements the `PostgresClient` interface from `@mvfm/plugin-postgres`:

- `query(sql, params)` → `db.query(sql, params)` → return `result.rows`
- `begin(fn)` → `db.transaction(async (tx) => fn(wrapPgLite(tx)))`
- `savepoint(fn)` → manual `SAVEPOINT`/`RELEASE` via queries (PGLite may not expose savepoint API)
- `cursor(sql, params, batchSize, fn)` → fetch all rows, slice into batches, call `fn` per batch

### 2. `PgLitePlayground` React component

**File:** `packages/docs/src/components/PgLitePlayground.tsx`

- On mount: show loading spinner, `await import("@electric-sql/pglite")`, init in-memory DB
- Seed schema: `CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT)`
- Code editor using `react-simple-code-editor` (same as existing playground)
- RUN button executes code with real postgres interpreter via `foldAST`
- Output panel shows console output and return value
- "Reset DB" button to re-initialize

### 3. Astro page

**File:** `packages/docs/src/pages/pglite-spike.astro`

Minimal page mounting `<PgLitePlayground client:load />` with a default example that does INSERT + SELECT.

## Not in scope

- Per-example DB isolation
- Integration with the existing example/mockInterpreter system
- Fixing the broken mockInterpreter plumbing
- Any postgres docs page work (that's #239)
- Production readiness

## Validation

- Navigate to `/pglite-spike` in browser
- See loading spinner while WASM initializes
- Click RUN on default example
- See real query results in output
- Edit the query, run again, see different results
- Verify via Chrome DevTools MCP
