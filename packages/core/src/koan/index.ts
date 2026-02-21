import { buildKindInputs, buildLiftMap, buildTraitMap, boolPluginU, lt, mvfmU, numPluginU, ordPlugin, stdPlugins, strPluginU } from "./composition";
import { add, boolLit, eq, isCExpr, makeCExpr, makeNExpr, mul, numLit, strLit, sub } from "./expr";
import { incrementId } from "./increment";
import { app, createApp } from "./normalize";
import { appS, point } from "./structural";
import { deepThing } from "./accessor";

/**
 * Koan-model API namespace (00-03a compatibility surface).
 */
export const koan = {
  add,
  boolLit,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  createApp,
  app,
  appS,
  point,
  deepThing,
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

export type {
  AdjOf,
  CExpr,
  CtrOf,
  IdOf,
  KindSpec,
  LiftKind,
  NExpr,
  OutOf,
  RuntimeEntry,
  StdRegistry,
  TraitKindSpec,
  TypeKey,
} from "./expr";
export type { Plugin, PluginShape, RegistryOf, TraitDef } from "./composition";
export type { Increment, IncrementLast } from "./increment";
export type { NeverGuard } from "./normalize-types";
