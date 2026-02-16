# Enforce Handler Node Types in Interpreter/CompleteInterpreter

**Issue:** #197
**Date:** 2026-02-16
**Status:** Design approved

## Problem

`Interpreter` and `CompleteInterpreter<K>` use `(node: any)` as the handler signature. `typedFoldAST` checks that every node kind has a handler, but not that the handler's node parameter is correctly typed. A handler reading `node.banana` on a `redis/set` node compiles clean.

## Approach: NodeTypeMap Registry + Builder Function

### Spike findings

A plain mapped type (`CompleteInterpreter<K>` using `Handler<NodeTypeMap[key]>`) catches wrong node types but **cannot reject `node: any`** — TypeScript's `any` bypasses contravariance. Three spikes confirmed this and found a working solution: a curried builder function with `IsAny` detection.

### Core changes in `fold.ts`

Add an empty interface that plugins extend:

```ts
export interface NodeTypeMap {}
```

Add helper types:

```ts
type IsAny<T> = 0 extends (1 & T) ? true : false;

type NodeForKind<K extends string> =
  K extends keyof NodeTypeMap ? NodeTypeMap[K] : TypedNode;

type ReturnOfNode<N extends TypedNode<any>> =
  N extends TypedNode<infer T> ? T : unknown;

type ExpectedHandler<K extends string> =
  (node: NodeForKind<K>) => AsyncGenerator<FoldYield, ReturnOfNode<NodeForKind<K>>, unknown>;

type ExtractNodeParam<F> =
  F extends (node: infer N, ...args: any[]) => any ? N : unknown;

type RejectAnyParam<K extends string, H> =
  IsAny<ExtractNodeParam<H>> extends true
    ? K extends keyof NodeTypeMap ? never : H
    : H;

type RequiredShape<K extends string> = {
  [P in K]: ExpectedHandler<P>;
};
```

Add the builder function:

```ts
export function typedInterpreter<K extends string>() {
  return <T extends RequiredShape<K>>(handlers: T & {
    [P in K]: P extends keyof T ? RejectAnyParam<P, T[P]> : ExpectedHandler<P>;
  }): T => handlers;
}
```

**How it works:**
- `K` is specified explicitly (the kinds this interpreter handles)
- `T` is inferred from the object literal (preserves actual handler types)
- `RequiredShape<K>` ensures completeness and correct node types
- `RejectAnyParam` uses `IsAny` to detect `any` parameters and map them to `never` for registered kinds
- Unregistered kinds (not in `NodeTypeMap`) allow `any` as a migration escape hatch

**API:**
```ts
const interp = typedInterpreter<"redis/set" | "redis/get">()({
  "redis/set": async function* (node: RedisSetNode) { ... },
  "redis/get": async function* (node: RedisGetNode) { ... },
});
```

The curried `()()` is necessary because TypeScript cannot partially infer generics.

Update `CompleteInterpreter` to use `NodeTypeMap` (for `typedFoldAST` compatibility):

```ts
export type CompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof NodeTypeMap
    ? Handler<NodeTypeMap[key]>
    : (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
};
```

- **`Interpreter`** stays as-is (`Record<string, (node: any) => ...>`). It's the untyped runtime record used by `foldAST`.
- **`Handler<N>`** already exists and is unchanged.
- **`NodeTypeMap`** and **`typedInterpreter`** are exported from `core/src/index.ts`.

### Plugin registration pattern

Each plugin adds a module augmentation and wraps its handler object:

```ts
// 1. Augment the registry
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "redis/set": RedisSetNode;
    "redis/get": RedisGetNode;
    // ... every kind the plugin emits
  }
}

// 2. Wrap handler object in builder
export function createRedisInterpreter(client: RedisClient) {
  return typedInterpreter<"redis/set" | "redis/get" | ...>()({
    "redis/set": async function* (node: RedisSetNode) { ... },
    ...
  });
}
```

Core interpreter nodes register in `core/src/interpreters/core.ts` using `declare module "../fold"` (same package).

### Plugins that register in this PR

Only plugins that already have typed node interfaces:

- **core** — all `core/*` node kinds (9 kinds)
- **plugin-redis** — all `redis/*` node kinds (35 kinds)
- **plugin-postgres** — all `postgres/*` node kinds (8 kinds)
- **plugin-zod** — if #192 (zod typed nodes) lands before this PR

### Follow-up issues (created as part of this work)

One issue per untyped plugin to add typed interfaces + register in `NodeTypeMap`:

- error, fiber, control (core prelude)
- boolean, num, str, eq, ord (core prelude)
- anthropic, openai, fal (AI plugins)
- fetch, s3, cloudflare-kv (data plugins)
- slack, resend, twilio (messaging plugins)
- stripe (payments)
- pino, console (observability)

Plus a **final issue** to flip the `any` fallback to `never`, closable once all plugins are registered.

## Spike phase (mandatory, before implementation)

A standalone TypeScript file that proves the type machinery holds. **If any hard-stop criterion fails, we reassess the approach rather than continuing.**

### What the spike validates

1. Declaration merging works across modules
2. `CompleteInterpreter<K>` rejects `node: any` for a registered kind
3. `CompleteInterpreter<K>` rejects wrong node types for a kind
4. `CompleteInterpreter<K>` accepts correct node types
5. Spread composition of two well-typed interpreters satisfies `CompleteInterpreter<KA | KB>`
6. `Handler<N>` return type inference works via phantom `T`
7. Unregistered kinds hit `never`

### Hard-stop criteria

- Items 1, 2, or 5 fail → approach is fundamentally broken, stop
- Items 3, 4, 6, or 7 fail → may be fixable with type-level adjustments, pause to evaluate

## Validation (`@ts-expect-error` tests)

After implementation, add compile-time negative tests:

```ts
// @ts-expect-error: 'any' not assignable to specific node type
const bad1: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: any) { return null; }
};

// @ts-expect-error: wrong node type
const bad2: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: RedisGetNode) { return null; }
};

// Correct — compiles
const good: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: RedisSetNode) { /* ... */ return null; }
};

// Spread composition — compiles
const composed: CompleteInterpreter<"redis/set" | "redis/get"> = {
  ...redisSetInterp,
  ...redisGetInterp,
};
```

Checked by `pnpm run build` — no runtime needed. If someone loosens the types, the `@ts-expect-error` lines stop being errors and tsc reports "unused @ts-expect-error."

## What does NOT change

- `Interpreter` type (runtime, stays `any`)
- `foldAST` function (runtime, unchanged)
- `typedFoldAST` function (unchanged)
- `Handler<N>` type (already correct)
- Runtime behavior of any kind
- Plugin `build()` contracts or `PluginDefinition`
- Handler implementations (same async generator signatures)

## What changes for plugins

- Interpreter factory functions wrap their handler object in `typedInterpreter<...>()()`
- Each plugin adds a `declare module` augmentation block for `NodeTypeMap`
- Node interfaces that were previously unexported must be exported

## Risks

If a plugin's existing handler signatures don't exactly match `Handler<NodeTypeMap[key]>` (e.g. a handler returns `string` but the phantom type says `string | null`), we'll get compile errors. These are real type bugs being surfaced — fix them, don't loosen the types.

## Spike validation (updated)

The spike must also validate item 7 positively — unregistered kinds get `any` fallback (not `never`). This is the temporary state. The final "flip to never" issue will change this behavior.
