import type { PluginDefinition } from "@mvfm/core";
import { ZodStringBuilder } from "./string";
import { itemsToAST, ZodTupleBuilder } from "./tuple";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodStringBuilder } from "./string";
export { ZodTupleBuilder } from "./tuple";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";

// Import the base type for composite schema signatures
import type { ZodSchemaBuilder } from "./base";

/** Helper to extract error string from the common `errorOrOpts` parameter pattern. */
function parseError(errorOrOpts?: string | { error?: string }): string | undefined {
  return typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
}

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

  /** Create a tuple schema builder with fixed items and optional rest element. */
  tuple<T extends unknown[]>(
    items: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
    rest?: ZodSchemaBuilder<unknown>,
    errorOrOpts?: string | { error?: string },
  ): ZodTupleBuilder<T>;
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
    "zod/tuple", // #111

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
          const error = parseError(errorOrOpts);
          return new ZodStringBuilder(ctx, [], [], error);
        },

        tuple<T extends unknown[]>(
          items: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
          rest?: ZodSchemaBuilder<unknown>,
          errorOrOpts?: string | { error?: string },
        ): ZodTupleBuilder<T> {
          const error = parseError(errorOrOpts);
          const extra: Record<string, unknown> = {
            items: itemsToAST(items as ZodSchemaBuilder<unknown>[]),
          };
          if (rest) {
            extra.rest = rest.__schemaNode;
          }
          return new ZodTupleBuilder<T>(ctx, [], [], error, extra);
        },
      },
    };
  },
};
