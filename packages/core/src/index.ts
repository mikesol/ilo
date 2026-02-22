/**
 * @mvfm/core — public API surface.
 *
 * Organized into five tiers:
 *   1. Public API — the main consumer-facing functions
 *   2. Plugins — built-in plugin instances and constructors
 *   3. Types — core type definitions for programs, plugins, expressions
 *   4. Compat shims — legacy API bridge for plugins not yet migrated
 *   5. Advanced / internal — DAG ops, predicates, elaboration internals
 */

// ─── 1. Public API ──────────────────────────────────────────────────
// Consumer-facing: mvfm, fold, defaults, injectInput, prelude

export { mvfm, fold, defaults, injectInput, prelude } from "./api";

// ─── 2. Plugins ─────────────────────────────────────────────────────
// Built-in plugin values and the core plugin/interpreter

export { numPlugin, boolPlugin, strPlugin, ordPlugin } from "./std-plugins";
export { coreInterpreter, corePlugin } from "./core-plugin";
export { st } from "./st";
export { error } from "./error";
export { control } from "./control";

// ─── 3. Types ───────────────────────────────────────────────────────
// Core type definitions used by plugin authors and consumers

export type { Program } from "./api";
export type { Plugin, Interpreter, Handler, FoldYield } from "./plugin";
export type { CExpr, NExpr, RuntimeEntry } from "./expr";
export type { KindSpec, TraitKindSpec, RegistryEntry, StdRegistry } from "./registry";
export type { LiftKind, TypeKey } from "./registry";
export type { ScopedBinding, RecurseScopedEffect, TraitDef, DollarSign } from "./plugin";
export type { PluginDef, FoldState } from "./fold";

// ─── 4. Compat shims ───────────────────────────────────────────────
// Legacy API bridge — kept for external plugins not yet migrated (zod, openai, anthropic).
// These will be removed once all external plugins use the new API.

export {
  type TypedNode,
  type NodeTypeMap,
  type ExprBase,
  type Expr,
  type PluginContext,
  definePlugin,
  defineInterpreter,
  eval_,
  foldAST,
} from "./compat";

// U-suffixed aliases — deprecated, kept for external plugins not yet migrated.
import { numPlugin } from "./std-plugins";
import { strPlugin } from "./std-plugins-str";
import { boolPlugin } from "./std-plugins-bool";
/** @deprecated Use numPlugin instead. */
export const numPluginU = numPlugin;
/** @deprecated Use strPlugin instead. */
export const strPluginU = strPlugin;
/** @deprecated Use boolPlugin instead. */
export const boolPluginU = boolPlugin;

// ─── 5. Advanced / internal escape hatch ────────────────────────────
// DAG construction, elaboration, predicates, expression helpers.
// Use these when building custom tooling on top of the core.

// Expression constructors and inspectors
export { makeCExpr, isCExpr, makeNExpr, CREF } from "./expr";
export type {
  COutOf, CKindOf, CArgsOf,
  IdOf, AdjOf, CtrOf, OutOf,
  NodeEntry, AccessorOverlay,
} from "./expr";

// Elaboration (CExpr → NExpr)
export { createApp, app } from "./elaborate";
export { LIFT_MAP, TRAIT_MAP, KIND_INPUTS } from "./elaborate";
export type {
  SNodeEntry, NeverGuard, DeepResolve, UnionToTuple,
  ElaborateExpr, AppResult,
} from "./elaborate-types";

// Plugin composition
export { mvfmU, buildLiftMap, buildTraitMap, buildKindInputs, buildStructuralShapes } from "./plugin";
export type { RegistryOf } from "./plugin";

// Fold internals
export { VOLATILE_KINDS, createFoldState, recurseScoped } from "./fold";

// DAG operations
export { pipe } from "./dagql";
export * from "./dirty";
export * from "./gc";
export * from "./map";
export * from "./named";
export * from "./predicates";
export * from "./replace";
export * from "./select";
export * from "./splice";
export * from "./wrap";
export * from "./increment";
export * from "./structural-children";

// Commit / gc
export { gc, commit } from "./commit";

// Constructors (num, str, bool helpers)
export * from "./constructors";

// Std plugin internals
export { stdPlugins, lt } from "./std-plugins";
export { boolPlugin as _boolPluginDef } from "./std-plugins-bool";
export { strPlugin as _strPluginDef } from "./std-plugins-str";
export { ordPlugin as _ordPluginDef } from "./std-plugins-ord";
