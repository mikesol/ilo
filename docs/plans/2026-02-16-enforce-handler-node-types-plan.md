# Enforce Handler Node Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `NodeTypeMap` registry + `typedInterpreter` builder so handlers are type-checked at compile time — including rejection of `node: any`.

**Architecture:** Declaration-merged `NodeTypeMap` in `fold.ts`. Curried `typedInterpreter<K>()({...})` builder uses `IsAny` detection to reject `any`-typed handlers. `CompleteInterpreter<K>` updated for `typedFoldAST` compatibility. Plugins augment `NodeTypeMap` and wrap handler objects in the builder.

**Tech Stack:** TypeScript (declaration merging, mapped types, conditional types, module augmentation)

---

### Task 1: Spike — validate type machinery

**Status:** COMPLETED. All 7 criteria pass with builder pattern (spike v3).

---

### Task 2: Add NodeTypeMap, helper types, and typedInterpreter builder

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Add NodeTypeMap and helper types to fold.ts**

Add after the `Handler` type (after line 60):

```ts
/**
 * Global registry mapping node kind strings to their typed node interfaces.
 * Plugins extend this via declaration merging (module augmentation).
 *
 * @example
 * ```ts
 * declare module "@mvfm/core" {
 *   interface NodeTypeMap {
 *     "myplugin/op": MyOpNode;
 *   }
 * }
 * ```
 */
export interface NodeTypeMap {}

/** Detect the `any` type. Returns `true` for `any`, `false` otherwise. */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/** Look up the node type for a kind from the registry, falling back to TypedNode. */
type NodeForKind<K extends string> =
  K extends keyof NodeTypeMap ? NodeTypeMap[K] : TypedNode;

/** Extract the phantom return type from a TypedNode. */
type ReturnOfNode<N extends TypedNode<any>> =
  N extends TypedNode<infer T> ? T : unknown;

/** The exact handler signature required for a given kind. */
type ExpectedHandler<K extends string> =
  (node: NodeForKind<K>) => AsyncGenerator<FoldYield, ReturnOfNode<NodeForKind<K>>, unknown>;

/** Extract the node parameter type from a handler function. */
type ExtractNodeParam<F> =
  F extends (node: infer N, ...args: any[]) => any ? N : unknown;

/**
 * Reject handlers with `any`-typed node parameters for registered kinds.
 * Unregistered kinds (not in NodeTypeMap) allow `any` as a migration escape hatch.
 */
type RejectAnyParam<K extends string, H> =
  IsAny<ExtractNodeParam<H>> extends true
    ? K extends keyof NodeTypeMap ? never : H
    : H;

/** Required handler shape for a set of kinds. */
type RequiredShape<K extends string> = {
  [P in K]: ExpectedHandler<P>;
};
```

**Step 2: Add the typedInterpreter builder function**

Add after the helper types:

```ts
/**
 * Create a typed interpreter with compile-time enforcement of handler signatures.
 *
 * Uses a curried form because TypeScript cannot partially infer generics —
 * `K` (the kinds) is specified explicitly, while `T` (handler types) is inferred.
 *
 * For registered kinds (in {@link NodeTypeMap}), this enforces:
 * - Correct node type on the handler parameter (not `any`, not wrong type)
 * - Correct return type matching the node's phantom `T`
 * - Completeness (every kind in `K` must have a handler)
 *
 * @example
 * ```ts
 * const interp = typedInterpreter<"redis/get" | "redis/set">()({
 *   "redis/get": async function* (node: RedisGetNode) { ... },
 *   "redis/set": async function* (node: RedisSetNode) { ... },
 * });
 * ```
 */
export function typedInterpreter<K extends string>() {
  return <T extends RequiredShape<K>>(
    handlers: T & {
      [P in K]: P extends keyof T ? RejectAnyParam<P, T[P]> : ExpectedHandler<P>;
    },
  ): T => handlers;
}
```

**Step 3: Update CompleteInterpreter**

Replace the existing `CompleteInterpreter` type:

```ts
/**
 * Complete interpreter type: must have a handler for every kind `K`.
 * Registered kinds (in {@link NodeTypeMap}) get full type checking via
 * {@link Handler}. Unregistered kinds fall back to `(node: any)`.
 */
export type CompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof NodeTypeMap
    ? Handler<NodeTypeMap[key]>
    : (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
};
```

**Step 4: Re-export from index.ts**

Add `NodeTypeMap`, `IsAny`, and `typedInterpreter` to the exports in `packages/core/src/index.ts`:

```ts
export type {
  CompleteInterpreter,
  FoldState,
  FoldYield,
  Handler,
  Interpreter,
  IsAny,
  NodeTypeMap,
  RecurseScopedEffect,
  ScopedBinding,
  TypedNode,
  TypedProgram,
} from "./fold";

export {
  checkCompleteness,
  createFoldState,
  eval_,
  foldAST,
  recurseScoped,
  typedFoldAST,
  typedInterpreter,
  VOLATILE_KINDS,
} from "./fold";
```

**Step 5: Verify build**

Run: `pnpm run build`
Expected: Clean build. `NodeTypeMap` is empty so all kinds fall through to `any` fallback.

**Step 6: Commit**

```bash
git add packages/core/src/fold.ts packages/core/src/index.ts
git commit -m "feat(core): add NodeTypeMap registry and typedInterpreter builder (#197)"
```

---

### Task 3: Register core interpreter node types

**Files:**
- Modify: `packages/core/src/interpreters/core.ts`

**Step 1: Export the node interfaces**

Add `export` to each interface (lines 6-53):

```ts
export interface CoreLiteral<T = unknown> extends TypedNode<T> { ... }
export interface CoreInput extends TypedNode<unknown> { ... }
// ... all 9 interfaces
```

**Step 2: Add NodeTypeMap augmentation**

After the interfaces, before the interpreter:

```ts
declare module "../fold" {
  interface NodeTypeMap {
    "core/literal": CoreLiteral;
    "core/input": CoreInput;
    "core/prop_access": CorePropAccess;
    "core/record": CoreRecord;
    "core/cond": CoreCond;
    "core/begin": CoreBegin;
    "core/program": CoreProgram;
    "core/tuple": CoreTuple;
    "core/lambda_param": CoreLambdaParam;
  }
}
```

Note: Uses `declare module "../fold"` (same package), not `"@mvfm/core"`.

**Step 3: Wrap coreInterpreter in typedInterpreter**

Change:
```ts
export const coreInterpreter: Interpreter = {
```
To:
```ts
export const coreInterpreter = typedInterpreter<
  | "core/literal"
  | "core/input"
  | "core/prop_access"
  | "core/record"
  | "core/cond"
  | "core/begin"
  | "core/program"
  | "core/tuple"
  | "core/lambda_param"
>()({
  // ... handlers unchanged ...
});
```

Close the object with `});` instead of `};`.

**Step 4: Verify build**

Run: `pnpm run build`
Expected: Clean build. Fix any type mismatches — they're real bugs the type system is now catching.

**Step 5: Commit**

```bash
git add packages/core/src/interpreters/core.ts
git commit -m "feat(core): register core node types in NodeTypeMap (#197)"
```

---

### Task 4: Register redis node types

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`

**Step 1: Export node interfaces**

Add `export` to each interface (lines 27-182). All 35+ interfaces need to be exported.

**Step 2: Add NodeTypeMap augmentation**

After the interfaces, before `createRedisInterpreter`:

```ts
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "redis/get": RedisGetNode;
    "redis/set": RedisSetNode;
    "redis/incr": RedisIncrNode;
    "redis/incrby": RedisIncrByNode;
    "redis/decr": RedisDecrNode;
    "redis/decrby": RedisDecrByNode;
    "redis/mget": RedisMGetNode;
    "redis/mset": RedisMSetNode;
    "redis/append": RedisAppendNode;
    "redis/getrange": RedisGetRangeNode;
    "redis/setrange": RedisSetRangeNode;
    "redis/del": RedisDelNode;
    "redis/exists": RedisExistsNode;
    "redis/expire": RedisExpireNode;
    "redis/pexpire": RedisPExpireNode;
    "redis/ttl": RedisTTLNode;
    "redis/pttl": RedisPTTLNode;
    "redis/hget": RedisHGetNode;
    "redis/hset": RedisHSetNode;
    "redis/hmget": RedisHMGetNode;
    "redis/hgetall": RedisHGetAllNode;
    "redis/hdel": RedisHDelNode;
    "redis/hexists": RedisHExistsNode;
    "redis/hlen": RedisHLenNode;
    "redis/hkeys": RedisHKeysNode;
    "redis/hvals": RedisHValsNode;
    "redis/hincrby": RedisHIncrByNode;
    "redis/lpush": RedisLPushNode;
    "redis/rpush": RedisRPushNode;
    "redis/lpop": RedisLPopNode;
    "redis/rpop": RedisRPopNode;
    "redis/llen": RedisLLenNode;
    "redis/lrange": RedisLRangeNode;
    "redis/lindex": RedisLIndexNode;
    "redis/lset": RedisLSetNode;
    "redis/lrem": RedisLRemNode;
    "redis/linsert": RedisLInsertNode;
  }
}
```

**Step 3: Wrap createRedisInterpreter return in typedInterpreter**

Change the return statement to use the builder. Import `typedInterpreter` from `@mvfm/core`.

```ts
import { eval_, typedInterpreter } from "@mvfm/core";
import type { TypedNode } from "@mvfm/core";

// ...

export function createRedisInterpreter(client: RedisClient) {
  return typedInterpreter<
    | "redis/get" | "redis/set" | "redis/incr" | "redis/incrby"
    | "redis/decr" | "redis/decrby" | "redis/mget" | "redis/mset"
    | "redis/append" | "redis/getrange" | "redis/setrange"
    | "redis/del" | "redis/exists" | "redis/expire" | "redis/pexpire"
    | "redis/ttl" | "redis/pttl"
    | "redis/hget" | "redis/hset" | "redis/hmget" | "redis/hgetall"
    | "redis/hdel" | "redis/hexists" | "redis/hlen" | "redis/hkeys"
    | "redis/hvals" | "redis/hincrby"
    | "redis/lpush" | "redis/rpush" | "redis/lpop" | "redis/rpop"
    | "redis/llen" | "redis/lrange" | "redis/lindex" | "redis/lset"
    | "redis/lrem" | "redis/linsert"
  >()({
    // ... handlers unchanged ...
  });
}
```

Also update the return type annotation: remove `: Interpreter` (the builder infers the correct type).

**Step 4: Verify build**

Run: `pnpm run build`
Expected: Clean build. Fix any type mismatches.

**Step 5: Run tests**

Run: `pnpm run test --filter plugin-redis`
Expected: All redis tests pass.

**Step 6: Commit**

```bash
git add packages/plugin-redis/src/5.4.1/interpreter.ts
git commit -m "feat(plugin-redis): register redis node types in NodeTypeMap (#197)"
```

---

### Task 5: Register postgres node types

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/interpreter.ts`

**Step 1: Add NodeTypeMap augmentation**

Interfaces are already exported (lines 35-95). Add augmentation after them:

```ts
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "postgres/query": PostgresQueryNode;
    "postgres/identifier": PostgresIdentifierNode;
    "postgres/insert_helper": PostgresInsertHelperNode;
    "postgres/set_helper": PostgresSetHelperNode;
    "postgres/begin": PostgresBeginNode;
    "postgres/savepoint": PostgresSavepointNode;
    "postgres/cursor": PostgresCursorNode;
    "postgres/cursor_batch": PostgresCursorBatchNode;
  }
}
```

**Step 2: Wrap createPostgresInterpreter in typedInterpreter**

Import `typedInterpreter` from `@mvfm/core`. Update:

```ts
export function createPostgresInterpreter(client: PostgresClient) {
  return typedInterpreter<
    | "postgres/query" | "postgres/identifier" | "postgres/insert_helper"
    | "postgres/set_helper" | "postgres/begin" | "postgres/savepoint"
    | "postgres/cursor" | "postgres/cursor_batch"
  >()({
    // ... handlers ...
  });
}
```

Note: The stub handlers for `postgres/identifier`, `postgres/insert_helper`, and `postgres/set_helper` (lines 207-225) currently have no typed node parameter. Add the typed param:

```ts
"postgres/identifier": async function* (_node: PostgresIdentifierNode) {
  throw new Error("...");
},
```

**Step 3: Check handler.server.ts**

The server interpreter in `handler.server.ts` uses `createPostgresServerInterpreter` which may also need updating. Check if it returns an `Interpreter` type and whether it should also use `typedInterpreter`. If it spreads with `createPostgresInterpreter`, the types should compose naturally.

**Step 4: Verify build**

Run: `pnpm run build`
Expected: Clean build.

**Step 5: Run tests**

Run: `pnpm run test --filter plugin-postgres`
Expected: All postgres tests pass.

**Step 6: Commit**

```bash
git add packages/plugin-postgres/src/3.4.8/interpreter.ts
git commit -m "feat(plugin-postgres): register postgres node types in NodeTypeMap (#197)"
```

---

### Task 6: Add compile-time type tests

**Files:**
- Create: `packages/core/src/__tests__/node-type-map.type-test.ts`

**Step 1: Write type tests using typedInterpreter**

```ts
/**
 * Compile-time tests for NodeTypeMap + typedInterpreter type enforcement.
 * Checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 */

import { typedInterpreter } from "../fold";
import type { CoreLiteral, CoreInput } from "../interpreters/core";

// --- Positive: correct handler compiles ---

const _correct = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Positive: spread composition compiles ---

const _litInterp = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});
const _inputInterp = typedInterpreter<"core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },
});
const _composed = { ..._litInterp, ..._inputInterp };

// --- Negative: node: any rejected for registered kind ---

// @ts-expect-error handler with node:any rejected by IsAny check
const _badAny = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node.value;
  },
});

// --- Negative: wrong node type rejected ---

// @ts-expect-error CoreInput should not satisfy handler for core/literal
const _badWrongType = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
});

// --- Negative: wrong return type rejected ---

// @ts-expect-error returning number should fail for CoreLiteral (phantom T = unknown)
const _badReturn = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return 42;
  },
});

// --- Negative: missing kind rejected ---

// @ts-expect-error missing "core/input" handler
const _badMissing = typedInterpreter<"core/literal" | "core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Unregistered kind: any fallback (temporary) ---

const _unregistered = typedInterpreter<"unregistered/kind">()({
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
});
```

**Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build.

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/__tests__/node-type-map.type-test.ts
git commit -m "test(core): add compile-time type tests for NodeTypeMap + typedInterpreter (#197)"
```

---

### Task 7: File follow-up issues

**Files:** None (GitHub API only)

**Step 1: Create per-plugin-group issues**

Group related plugins to keep issue count reasonable:

1. **Core prelude — error, fiber, control**: 11 kinds total
2. **Core prelude — boolean, num**: 29 kinds total
3. **Core prelude — str, eq, ord**: 22 kinds total
4. **AI plugins — anthropic, openai**: 17 kinds total
5. **Data plugins — fetch, s3, cloudflare-kv**: 15 kinds total
6. **Messaging plugins — slack, resend, twilio**: 39 kinds total
7. **Other plugins — stripe, pino, fal, console**: 22+ kinds total

Each issue:
- Title: "Add typed node interfaces for `<group>` and register in NodeTypeMap"
- Body: List all node kinds, reference #197, note that `typedInterpreter` builder must be used
- Label: `ready`
- Milestone: "Phase 1: Core Solidification"

**Step 2: Create the "flip to never" issue**

Title: "Remove `any` fallback from typedInterpreter — enforce NodeTypeMap for all kinds"
Body: Once all plugins register, change `RejectAnyParam` to reject `any` for ALL kinds (not just registered ones), and change `CompleteInterpreter` fallback from `any` to `never`.
Label: `ready`
Milestone: "Phase 1: Core Solidification"

---

### Task 8: Final validation

**Step 1: Full build + check + test**

Run: `pnpm run build && pnpm run check && pnpm run test`
Expected: All green.

**Step 2: Verify type enforcement end-to-end**

The compile-time type tests from Task 6 cover this permanently. Confirm they're in the build output.
