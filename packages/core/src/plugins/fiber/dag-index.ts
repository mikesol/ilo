/**
 * DAG-model fiber plugin definition.
 *
 * Provides par, race, seq concurrency primitives.
 * The interpreter needs access to the full interpreter for foldFrom.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createFiberDagInterpreter } from "./dag-interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model fiber plugin definition. */
export const fiberDagPlugin: PluginDefWithBuild = {
  name: "fiber",
  nodeKinds: ["fiber/par", "fiber/race", "fiber/seq"],
  defaultInterpreter: () => {
    // Default: sequential-only (par acts like seq)
    // For true parallelism, use createFiberDagInterpreter with the full interp
    let _interp: Record<string, unknown> = {};
    const interp = createFiberDagInterpreter(() => _interp as any);
    _interp = interp;
    return interp;
  },
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      fiber: {
        /** Run children in parallel, return all results. */
        par: (...branches: E[]) =>
          ctx.node("fiber/par", branches),
        /** Race: first to complete wins. */
        race: (...branches: E[]) =>
          ctx.node("fiber/race", branches),
        /** Sequential: run in order, return last. */
        seq: (...steps: E[]) =>
          ctx.node("fiber/seq", steps),
      },
    };
  },
};
