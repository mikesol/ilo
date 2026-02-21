import { buildKindInputs, buildLiftMap, buildTraitMap, boolPluginU, lt, mvfmU, numPluginU, ordPlugin, stdPlugins, strPluginU } from "./composition";
import { add, boolLit, eq, isCExpr, makeCExpr, makeNExpr, mul, numLit, strLit, sub } from "./expr";
import { incrementId } from "./increment";

/**
 * Koan-model API namespace (00-03a compatibility surface).
 */
export const koan = {
  add,
  boolLit,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  eq,
  incrementId,
  isCExpr,
  lt,
  makeCExpr,
  makeNExpr,
  mul,
  mvfmU,
  numLit,
  strLit,
  sub,
  boolPluginU,
  numPluginU,
  ordPlugin,
  stdPlugins,
  strPluginU,
};

export type { CExpr, KindSpec, NExpr, RuntimeEntry, TraitKindSpec } from "./expr";
export type { Plugin, TraitDef } from "./composition";
