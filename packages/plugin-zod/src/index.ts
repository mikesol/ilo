import type { PluginDefinition } from "@mvfm/core";
import { ZodArrayBuilder } from "./array";
import { ZodStringBuilder } from "./string";

export { ZodArrayBuilder } from "./array";
// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodStringBuilder } from "./string";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";

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

  /** Create an array schema builder with the given element schema. */
  array<T>(
    element: ZodSchemaBuilder<T>,
    errorOrOpts?: string | { error?: string },
  ): ZodArrayBuilder<T>;
}

// Import the base type for the array() signature
import type { ZodSchemaBuilder } from "./base";

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
    "zod/array", // #110

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

        array<T>(
          element: ZodSchemaBuilder<T>,
          errorOrOpts?: string | { error?: string },
        ): ZodArrayBuilder<T> {
          const error = parseError(errorOrOpts);
          return new ZodArrayBuilder<T>(ctx, [], [], error, {
            element: element.__schemaNode,
          });
        },
      },
    };
  },
};
