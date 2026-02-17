# Design: st interpreter (issue #220)

## Problem

The `st` plugin emits `st/let`, `st/get`, `st/set`, `st/push` node kinds but has no interpreter. Programs using `st` cannot be executed with `foldAST`, and `defaults(mvfm(prelude, st))` fails at compile time.

## Architecture

**Factory function**: `createStInterpreter()` returns an `Interpreter<"st/let" | "st/get" | "st/set" | "st/push">` with a closed-over `Map<string, unknown>` as the variable store. Each invocation creates a fresh store so separate `foldAST` calls are isolated.

**Convenience export**: `stInterpreter` is a pre-created instance used as the `defaultInterpreter` on the plugin. Users who need a fresh store per call can use `createStInterpreter()`.

## Node handlers

| Kind | Behavior | Return |
|------|----------|--------|
| `st/let` | Evaluate `node.initial`, store result in `store[ref]` | `undefined` |
| `st/get` | Return `store[ref]`, throw if ref not found | The stored value |
| `st/set` | Evaluate `node.value`, replace `store[ref]` | `undefined` |
| `st/push` | Evaluate `node.value`, push onto `store[ref]` (must be array) | `undefined` |

## Volatility

`st/get` is added to `VOLATILE_KINDS` so `foldAST` never caches it. Without this, repeated reads of the same variable return stale values after `st/set` or `st/push`.

## Node type declarations

```typescript
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "st/let": StLetNode;   // TypedNode<void>
    "st/get": StGetNode;   // TypedNode<unknown>
    "st/set": StSetNode;   // TypedNode<void>
    "st/push": StPushNode; // TypedNode<void>
  }
}
```

## Files changed

1. `packages/core/src/plugins/st/interpreter.ts` — New: `createStInterpreter()` and `stInterpreter`
2. `packages/core/src/plugins/st/index.ts` — Add `defaultInterpreter: stInterpreter`
3. `packages/core/src/fold.ts` — Add `"st/get"` to `VOLATILE_KINDS`
4. `packages/core/src/index.ts` — Export `stInterpreter` and `createStInterpreter`
5. `packages/core/tests/plugins/st/interpreter.test.ts` — New test file

## Test cases

- `defaults(mvfm(prelude, st))` works without override
- `st/let` + `st/get` returns the initial value
- `st/set` + `st/get` returns the updated value
- `st/push` appends to an array variable
- `st/get` on undefined ref throws
- Multiple variables are independent
- `st/get` is not cached (re-reads after mutation return new values)
