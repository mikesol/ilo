/**
 * Compile-time tests for CompleteInterpreter + TypedProgram enforcement.
 * Checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 *
 * See also: node-type-map.type-test.ts for typedInterpreter tests.
 */

import {
  type CompleteInterpreter,
  type TypedNode,
  type TypedProgram,
  typedInterpreter,
} from "../fold";
import type { CoreInput, CoreLiteral } from "../interpreters/core";

// ============================================================
// CompleteInterpreter tests (gates typedFoldAST)
// ============================================================

// --- Positive: registered kind, correct handler type ---

const _ciCorrect: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};

// --- Positive: multi-kind completeness ---

const _ciMulti: CompleteInterpreter<"core/literal" | "core/input"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
  // biome-ignore lint/correctness/useYield: type test
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },
};

// --- Known gap: registered kind, node: any compiles through CompleteInterpreter ---
// Handler<T> doesn't use RejectAnyParam — `any` is assignable to any function param.
// The defense against `any` is in typedInterpreter (tested in node-type-map.type-test.ts),
// which all plugins must use to build their interpreters.

const _ciAnyPassesThrough: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node.value;
  },
};

// --- Negative: registered kind, wrong node type rejected ---

const _ciBadWrongType: CompleteInterpreter<"core/literal"> = {
  // @ts-expect-error CompleteInterpreter rejects wrong node type
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
};

// --- Negative: unregistered kind produces never (cannot satisfy) ---

const _ciUnregistered: CompleteInterpreter<"unregistered/kind"> = {
  // @ts-expect-error unregistered kind maps to never — no valid handler exists
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: TypedNode) {
    return node;
  },
};

// --- Negative: unregistered kind with node:any also rejected ---

const _ciUnregisteredAny: CompleteInterpreter<"unregistered/kind"> = {
  // @ts-expect-error unregistered kind maps to never — any handler also rejected
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
};

// --- Negative: missing kind from CompleteInterpreter ---

// @ts-expect-error missing "core/input" handler
const _ciMissing: CompleteInterpreter<"core/literal" | "core/input"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};

// ============================================================
// TypedProgram + typedFoldAST assignment tests
// ============================================================

// --- Negative: unregistered kind in TypedProgram cannot get a valid interpreter ---

declare const _unregisteredProgram: TypedProgram<"unregistered/kind">;
const _ciForUnregisteredProgram: CompleteInterpreter<
  typeof _unregisteredProgram extends TypedProgram<infer K> ? K : never
> = {
  // @ts-expect-error no valid CompleteInterpreter handler exists for unregistered kind in TypedProgram
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (_node: TypedNode) {
    return undefined;
  },
};

// ============================================================
// typedInterpreter: unregistered kind with TypedNode (non-any)
// ============================================================

// --- Positive: unregistered kind with TypedNode compiles in typedInterpreter ---
// NOTE: typedInterpreter allows this because NodeForKind falls back to TypedNode
// for unregistered kinds. The real gate is CompleteInterpreter (tested above),
// which maps unregistered kinds to `never`.

const _unregisteredTypedNode = typedInterpreter<"unregistered/kind">()({
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (_node: TypedNode) {
    return undefined;
  },
});
