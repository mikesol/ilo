/**
 * Compile-time tests for CompleteInterpreter and TypedProgram enforcement.
 * Checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 *
 * See also: node-type-map.type-test.ts for typedInterpreter tests.
 *
 * NOTE: typedFoldAST does NOT reject node:any (CompleteInterpreter is a type
 * alias, not a generic inference site). The any guard is in typedInterpreter
 * at construction time. Tracked for end-to-end fix in #233.
 */

import {
  type CompleteInterpreter,
  type TypedNode,
  type TypedProgram,
  typedInterpreter,
} from "../fold";
import type { CoreInput, CoreLiteral } from "../interpreters/core";

// ============================================================
// CompleteInterpreter type alias tests
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

// --- Negative: registered kind, wrong node type rejected ---

const _ciBadWrongType: CompleteInterpreter<"core/literal"> = {
  // @ts-expect-error CompleteInterpreter rejects wrong node type
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
};

// --- Negative: unregistered kind produces never ---

const _ciUnregistered: CompleteInterpreter<"unregistered/kind"> = {
  // @ts-expect-error unregistered kind maps to never
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: TypedNode) {
    return node;
  },
};

// --- Negative: unregistered kind with node:any also rejected ---

const _ciUnregisteredAny: CompleteInterpreter<"unregistered/kind"> = {
  // @ts-expect-error unregistered kind maps to never
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
};

// --- Negative: missing kind ---

// @ts-expect-error missing "core/input" handler
const _ciMissing: CompleteInterpreter<"core/literal" | "core/input"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};

// ============================================================
// TypedProgram assignment tests
// ============================================================

// --- Negative: unregistered kind in TypedProgram cannot get a valid interpreter ---

declare const _unregisteredProgram: TypedProgram<"unregistered/kind">;
const _ciForUnregisteredProgram: CompleteInterpreter<
  typeof _unregisteredProgram extends TypedProgram<infer K> ? K : never
> = {
  // @ts-expect-error no valid handler for unregistered kind
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (_node: TypedNode) {
    return undefined;
  },
};

// ============================================================
// typedInterpreter: unregistered kind with TypedNode
// ============================================================

// --- Positive: compiles because NodeForKind falls back to TypedNode ---
// The real gate is CompleteInterpreter (tested above) which maps to never.

const _unregisteredTypedNode = typedInterpreter<"unregistered/kind">()({
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (_node: TypedNode) {
    return undefined;
  },
});
