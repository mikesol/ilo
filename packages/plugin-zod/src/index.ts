import type { Expr, PluginDefinition } from "@mvfm/core";
import type { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import { buildCustom, buildPromise, ZodSimpleBuilder } from "./special";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodSimpleBuilder } from "./special";
export { ZodStringBuilder } from "./string";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";

/**
 * The `$.zod` namespace contributed by the Zod plugin.
 *
 * Provides factory methods for creating Zod schema builders:
 * `$.zod.string()`, `$.zod.number()`, `$.zod.object(...)`, etc.
 *
 * Each factory returns a schema builder with chainable methods
 * for adding checks, refinements, and wrappers. Call `.parse()`
 * or `.safeParse()` to produce a validation AST node.
 *
 * @example
 * ```ts
 * const app = mvfm(num, str, zod);
 * const prog = app(schema, $ => {
 *   const result = $.zod.string().min(5).safeParse($.input.name);
 *   return $.cond(result.success, result.data, $.fail("invalid"));
 * });
 * ```
 */
export interface ZodNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;

  /** Create an `any` schema that accepts all values. */
  any(): ZodSimpleBuilder<any>;

  /** Create an `unknown` schema that accepts all values (type-safe). */
  unknown(): ZodSimpleBuilder<unknown>;

  /** Create a `never` schema that rejects all values. */
  never(): ZodSimpleBuilder<never>;

  /** Create a `nan` schema that only accepts NaN. */
  nan(): ZodSimpleBuilder<number>;

  /** Create a `promise` schema that wraps an inner schema. */
  promise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>>;

  /** Create a custom schema with a DSL predicate. */
  custom<T = unknown>(
    fn: (val: Expr<unknown>) => Expr<boolean>,
    errorOrOpts?: string | { error?: string },
  ): ZodSimpleBuilder<T>;
}

/**
 * Zod validation DSL plugin for mvfm.
 *
 * Adds the `$.zod` namespace to the dollar object, providing factory
 * methods for building Zod-compatible validation schemas as AST nodes.
 * The default interpreter reconstructs actual Zod schemas at runtime.
 *
 * Requires `zod` v4+ as a peer dependency.
 */
export const zod: PluginDefinition<{ zod: ZodNamespace }> = {
  name: "zod",

  nodeKinds: [
    // Parsing operations (#96)
    "zod/parse",
    "zod/safe_parse",
    "zod/parse_async",
    "zod/safe_parse_async",

    // Schema types — each issue adds its kinds here
    "zod/string", // #100

    // Special types (#120)
    "zod/any",
    "zod/unknown",
    "zod/never",
    "zod/nan",
    "zod/promise",
    "zod/custom",

    // Wrappers (#99)
    "zod/optional",
    "zod/nullable",
    "zod/nullish",
    "zod/nonoptional",
    "zod/default",
    "zod/prefault",
    "zod/catch",
    "zod/readonly",
    "zod/branded",
  ],

  build(ctx) {
    return {
      zod: {
        string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
          const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
          return new ZodStringBuilder(ctx, [], [], error);
        },
        any(): ZodSimpleBuilder<any> {
          return new ZodSimpleBuilder<any>(ctx, "zod/any");
        },
        unknown(): ZodSimpleBuilder<unknown> {
          return new ZodSimpleBuilder<unknown>(ctx, "zod/unknown");
        },
        never(): ZodSimpleBuilder<never> {
          return new ZodSimpleBuilder<never>(ctx, "zod/never");
        },
        nan(): ZodSimpleBuilder<number> {
          return new ZodSimpleBuilder<number>(ctx, "zod/nan");
        },
        promise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>> {
          return buildPromise(ctx, inner);
        },
        custom<T = unknown>(
          fn: (val: Expr<unknown>) => Expr<boolean>,
          errorOrOpts?: string | { error?: string },
        ): ZodSimpleBuilder<T> {
          return buildCustom<T>(ctx, fn, errorOrOpts);
        },
      },
    };
  },
};
