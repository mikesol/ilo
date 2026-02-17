# Issue 210 Boolean/Num Typed Nodes Design

## Goal

Add typed interpreter node contracts for `boolean/*` and `num/*` kinds so `typedInterpreter` enforces handler node shapes through `NodeTypeMap`.

## Scope

- In scope: `packages/core/src/plugins/boolean/interpreter.ts`, `packages/core/src/plugins/num/interpreter.ts`, and representative compile-time checks in `packages/core/src/__tests__/node-type-map.type-test.ts`.
- Out of scope: runtime behavior changes, plugin surface/API redesign, exhaustive per-kind type tests.

## Approach Options

1. Minimal targeted typing (chosen): type boolean/num interpreter files directly and add representative type tests.
2. Exhaustive type-test matrix: higher confidence but noisy and high maintenance.
3. Split node interfaces to separate `nodes.ts`: cleaner factoring but unnecessary refactor for this issue.

## Chosen Design

- Co-locate exported typed node interfaces with each interpreter file, following existing `str`, `eq`, and `ord` patterns.
- Add `declare module "@mvfm/core"` augmentation for each `boolean/*` and `num/*` kind to register node contracts in `NodeTypeMap`.
- Replace untyped `Interpreter` maps with `typedInterpreter<Kinds>()` maps.
- Add compile-time assertions in `node-type-map.type-test.ts` for representative `boolean/not` and `num/neg` kinds (positive and `node:any` rejection).

## Data Flow and Error Handling

- No runtime execution-path changes; handlers still evaluate children with `eval_` and return existing values.
- Type enforcement now fails at compile time if handler node parameters diverge from registered node contracts.

## Validation Plan

- Red phase: add boolean/num compile-time assertions before implementation and observe TypeScript failure.
- Green phase: implement typed interfaces + NodeTypeMap augmentation and verify TypeScript passes.
- Final validation: `npm run build && npm run check && npm test`, plus focused `@mvfm/core` tests if environment-dependent suites fail.
