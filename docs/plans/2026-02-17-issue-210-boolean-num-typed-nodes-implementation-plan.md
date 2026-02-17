# Issue 210 Boolean/Num Typed Nodes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed node interfaces and `NodeTypeMap` registrations for boolean and num core plugins, and enforce them through `typedInterpreter` with compile-time tests.

**Architecture:** Keep node interface declarations colocated in each plugin interpreter (matching `str`, `eq`, `ord` patterns). Register every boolean/num kind via `declare module "@mvfm/core"` augmentation and switch handler maps from `Interpreter` to `typedInterpreter<Kinds>()`.

**Tech Stack:** TypeScript, module augmentation, typedInterpreter/NodeTypeMap, Vitest + tsc type tests.

---

### Task 1: Add failing type-level checks first (RED)

**Files:**
- Modify: `packages/core/src/__tests__/node-type-map.type-test.ts`

1. Add positive checks for one boolean and one num kind using inferred node parameter.
2. Add negative checks with `node: any` for one boolean and one num kind using `@ts-expect-error`.
3. Run `pnpm --filter @mvfm/core run build` and verify failure due to unregistered kinds still accepting `any`.

### Task 2: Type boolean interpreter and register kinds (GREEN)

**Files:**
- Modify: `packages/core/src/plugins/boolean/interpreter.ts`

1. Replace `Interpreter` map with typed node interfaces per boolean kind.
2. Add `declare module "@mvfm/core"` and register all `boolean/*` kinds listed in issue.
3. Define `BooleanKinds` union and switch export to `typedInterpreter<BooleanKinds>()`.
4. Keep runtime behavior unchanged.

### Task 3: Type num interpreter and register kinds (GREEN)

**Files:**
- Modify: `packages/core/src/plugins/num/interpreter.ts`

1. Replace `Interpreter` map with typed node interfaces per num kind.
2. Add `declare module "@mvfm/core"` and register all `num/*` kinds listed in issue.
3. Define `NumKinds` union and switch export to `typedInterpreter<NumKinds>()`.
4. Keep runtime behavior unchanged.

### Task 4: Finalize compile-time checks (REFACTOR)

**Files:**
- Modify: `packages/core/src/__tests__/node-type-map.type-test.ts`

1. Ensure new type tests compile in positive cases and fail only where `@ts-expect-error` is declared.
2. Keep tests representative (not exhaustive per kind) to avoid noise.

### Task 5: Verify and report

**Files:**
- No source changes required.

1. Run `npm run build`.
2. Run `npm run check`.
3. Run `npm test`.
4. Summarize results and changed files.
