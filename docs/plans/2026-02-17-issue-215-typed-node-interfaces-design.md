# Issue 215 Typed Node Interfaces Design

## Goal

Add typed node interfaces and `NodeTypeMap` registrations for the remaining plugin interpreter kinds in:
- stripe
- pino
- fal
- console

and migrate these interpreters to `typedInterpreter` so handler node parameters are enforced at compile time.

## Scope

In scope:
- `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts`
- `packages/plugin-pino/src/10.3.1/interpreter.ts`
- `packages/plugin-fal/src/1.9.1/interpreter.ts`
- `packages/plugin-console/src/22.0.0/interpreter.ts`
- plugin tests that need updates due to stricter typing

Out of scope:
- API surface changes in plugin `index.ts` files
- runtime behavior changes in interpreters/handlers
- adding new node kinds

## Existing Pattern To Match

Follow the pattern already established by issue #197 and follow-up typed node work:
1. Define one typed interface per node kind in the plugin interpreter module.
2. Add `declare module "@mvfm/core"` augmentation with `NodeTypeMap` entries for each kind.
3. Build the handler table with `typedInterpreter<KindUnion>()({...})`.
4. Keep node interfaces aligned with node objects emitted by plugin builders.

## Plugin-by-Plugin Design

### Stripe

Current state uses one broad `StripeNode` (`kind: string`, optional `id`/`params`).

Change to explicit node interfaces:
- `StripeCreatePaymentIntentNode`
- `StripeRetrievePaymentIntentNode`
- `StripeConfirmPaymentIntentNode`
- `StripeCreateCustomerNode`
- `StripeRetrieveCustomerNode`
- `StripeUpdateCustomerNode`
- `StripeListCustomersNode`
- `StripeCreateChargeNode`
- `StripeRetrieveChargeNode`
- `StripeListChargesNode`

`params` remains optional where builders currently emit `null`/optional behavior (`confirm`, `list_*`).

### Pino

Current state uses one broad `PinoNode`.

Change to typed base shape + level-specific interfaces:
- `PinoBaseNode<K extends string>` with `level`, `msg`, `mergeObject`, `bindings`
- `PinoTraceNode`, `PinoDebugNode`, `PinoInfoNode`, `PinoWarnNode`, `PinoErrorNode`, `PinoFatalNode`

Keep `level` field because the plugin includes it in emitted nodes and the shared handler relies on it.

### Fal

Current state uses one broad `FalNode`.

Change to explicit interfaces:
- `FalRunNode`
- `FalSubscribeNode`
- `FalQueueSubmitNode`
- `FalQueueStatusNode`
- `FalQueueResultNode`
- `FalQueueCancelNode`

All keep `endpointId` and optional `options` to match plugin builders.

### Console

Current state uses one broad `ConsoleMethodNode`.

Change to typed base + per-kind interfaces:
- `ConsoleMethodNode<K extends ConsoleMethodName>`
- one interface per console kind listed in issue #215

Each node retains `args: TypedNode[]`.

## Error Handling and Runtime Behavior

No runtime semantic changes are intended. Handler logic and client calls remain the same; changes are type-level safety and registration only.

## Testing Strategy

1. Run `pnpm build` in worktree to validate type-checking across all packages.
2. Run `pnpm check` for lint/format/type-level checks.
3. Run `pnpm test` to ensure runtime behavior is unchanged.
4. If failures appear, update only type annotations or tests required by stronger compile-time checks.

## Design Alignment

- **Deterministic/verifiable DSL core direction (VISION.md):** stronger typed node contracts improve interpreter correctness and make AST-to-handler mapping auditable.
- **Plugin contract discipline:** namespaced node kinds remain unchanged and explicitly registered in `NodeTypeMap`.
- **Incremental hardening:** this is a direct completion step after #197 without widening feature scope.
