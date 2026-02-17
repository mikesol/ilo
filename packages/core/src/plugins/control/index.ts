import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";
import { controlInterpreter } from "./interpreter";

/**
 * Control flow operations for iteration.
 */
export interface ControlMethods {
  /**
   * Iterate over each element of a collection, executing side effects.
   *
   * @param collection - The array expression to iterate, or a raw array to auto-lift.
   * @param body - Callback receiving each element as an `Expr<T>`.
   */
  each<T>(collection: Expr<T[]> | T[], body: (item: Expr<T>) => void): void;
  /**
   * Loop while a condition is true.
   *
   * @param condition - Boolean expression to evaluate each iteration.
   * @returns A builder with a `body` callback for the loop statements.
   */
  while(condition: Expr<boolean>): {
    body: (fn: () => void) => void;
  };
}

/**
 * Control flow plugin. Namespace: `control/`.
 *
 * Provides `each` for collection iteration and `while` for conditional loops.
 */
export const control = definePlugin({
  name: "control",
  nodeKinds: ["control/each", "control/while"],
  defaultInterpreter: () => controlInterpreter,
  build(ctx: PluginContext): ControlMethods {
    return {
      each<T>(collection: Expr<T[]> | T[], body: (item: Expr<T>) => void) {
        const lifted = ctx.lift(collection as Expr<T[]> | T[]);
        const paramNode: any = { kind: "core/lambda_param", name: "item" };
        const paramProxy = ctx.expr<T>(paramNode) as Expr<T>;
        const prevLen = ctx.statements.length;
        body(paramProxy);
        const bodyStatements = ctx.statements.splice(prevLen);
        ctx.emit({
          kind: "control/each",
          collection: lifted.__node,
          param: paramNode,
          body: bodyStatements,
        });
      },

      while(condition: Expr<boolean>) {
        return {
          body: (fn: () => void) => {
            const prevLen = ctx.statements.length;
            fn();
            const bodyStatements = ctx.statements.splice(prevLen);
            ctx.emit({
              kind: "control/while",
              condition: condition.__node,
              body: bodyStatements,
            });
          },
        };
      },
    };
  },
});
