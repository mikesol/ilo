/**
 * builder.ts — generic CExpr builder and mvfm() entry point.
 *
 * Provides:
 * - `node()`: generic content-addressed CExpr builder for arbitrary kinds
 * - `mvfm()`: entry point that composes plugin builders, runs user closure,
 *   normalizes to NExpr, and returns a Program
 */

import type { CExpr, NExpr, RuntimeEntry } from "./00-expr";
import { makeCExpr } from "./00-expr";
import { app } from "./03-normalize";
import type { PluginDef, Interpreter } from "./fold";
import { defaults, fold } from "./fold";
import { createCoreDagInterpreter } from "./core-interpreter";

// ─── Generic node builder ─────────────────────────────────────────

/**
 * Build a content-addressed CExpr node with arbitrary kind and children.
 *
 * The ID is deterministic from kind + child IDs + out value:
 * - Leaf nodes: `kind[JSON(out)]`
 * - Branch nodes: `kind(child1Id,child2Id,...)`
 *
 * Adjacency maps from all children are merged.
 */
export function node<O>(
  kind: string,
  children: CExpr<unknown, string, unknown>[],
  out?: O,
): CExpr<O, string, unknown> {
  const childIds = children.map((c) => c.__id);
  const id =
    children.length > 0
      ? `${kind}(${childIds.join(",")})`
      : `${kind}[${JSON.stringify(out)}]`;

  const adj: Record<string, RuntimeEntry> = {};
  for (const child of children) {
    Object.assign(adj, child.__adj);
  }
  adj[id] = { kind, children: childIds, out: out ?? undefined };

  return makeCExpr<O, string, unknown>(id, adj);
}

// ─── Core dollar methods ──────────────────────────────────────────

/** Core builder methods available on every $ object. */
export interface CoreDollar {
  /** Create a literal node with the given value. */
  literal: <T>(value: T) => CExpr<T, string, unknown>;
  /** Conditional: if pred then then_ else else_. */
  cond: (
    pred: CExpr<boolean, string, unknown>,
    then_: CExpr<unknown, string, unknown>,
    else_: CExpr<unknown, string, unknown>,
  ) => CExpr<unknown, string, unknown>;
  /** Evaluate side-effect, return result. */
  discard: (
    sideEffect: CExpr<unknown, string, unknown>,
    result: CExpr<unknown, string, unknown>,
  ) => CExpr<unknown, string, unknown>;
}

function makeCoreDollar(): CoreDollar {
  return {
    literal: <T>(value: T) => node<T>("core/literal", [], value),
    cond: (pred, then_, else_) =>
      node("core/cond", [pred, then_, else_]),
    discard: (sideEffect, result) =>
      node("core/discard", [sideEffect, result]),
  };
}

// ─── Program ──────────────────────────────────────────────────────

/** A normalized program ready for evaluation. */
export interface Program<O = unknown> {
  /** The normalized expression DAG. */
  expr: NExpr<O, string, unknown, string>;
  /** Plugin definitions used to build this program. */
  plugins: readonly PluginDef[];
  /** Evaluate the program with optional interpreter overrides. */
  eval(overrides?: Record<string, Interpreter>): Promise<O>;
}

// ─── PluginBuilders ───────────────────────────────────────────────

/** Context passed to plugin build() methods. */
export interface BuildContext {
  /** The generic node builder. */
  node: typeof node;
  /** Core dollar methods. */
  core: CoreDollar;
}

/**
 * Extended plugin definition with a build() method that returns
 * builder methods for the dollar object.
 */
export interface PluginDefWithBuild extends PluginDef {
  /** Build plugin-specific dollar methods. */
  build?: (ctx: BuildContext) => Record<string, unknown>;
}

// ─── mvfm() ──────────────────────────────────────────────────────

/** Core plugin definition for core/* node kinds. */
const corePlugin: PluginDef = {
  name: "core",
  nodeKinds: ["core/literal", "core/cond", "core/discard"],
  defaultInterpreter: createCoreDagInterpreter,
};

/**
 * Entry point: compose plugins, run user closure, normalize, return Program.
 *
 * Takes plugin definitions and a user closure. The closure receives a `$`
 * object with core methods plus plugin-contributed methods. The closure
 * returns a CExpr which is normalized to NExpr via `app()`.
 *
 * @example
 * ```ts
 * const prog = mvfm(numDagPlugin, ($) => {
 *   const three = $.num.literal(3);
 *   const four = $.num.literal(4);
 *   return $.num.add(three, four);
 * });
 * const result = await prog.eval(); // 7
 * ```
 */
export function mvfm<O>(
  plugins: PluginDefWithBuild | PluginDefWithBuild[],
  closure: ($: CoreDollar & Record<string, unknown>) => CExpr<O, string, unknown>,
): Program<O> {
  const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
  const allPlugins: PluginDef[] = [corePlugin, ...pluginArray];

  // Build the $ object
  const coreDollar = makeCoreDollar();
  const buildCtx: BuildContext = { node, core: coreDollar };
  const dollar: CoreDollar & Record<string, unknown> = { ...coreDollar };

  for (const plugin of pluginArray) {
    if (plugin.build) {
      const methods = plugin.build(buildCtx);
      Object.assign(dollar, methods);
    }
  }

  // Run user closure to get CExpr
  const cexpr = closure(dollar);

  // Normalize to NExpr
  const expr = app(cexpr);

  return {
    expr: expr as NExpr<O, string, unknown, string>,
    plugins: allPlugins,
    eval(overrides?: Record<string, Interpreter>): Promise<O> {
      const interp = defaults(allPlugins, overrides);
      return fold(this.expr, interp);
    },
  };
}
