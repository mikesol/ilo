import type { PluginDefinition } from "@mvfm/core";
import { ZodIntersectionBuilder } from "./intersection";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodIntersectionBuilder } from "./intersection";
export { ZodStringBuilder } from "./string";
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
 * Provides factory methods for creating Zod schema builders.
 */
export interface ZodNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;

  /** Create an intersection schema builder (A & B). */
  intersection<A, B>(
    left: ZodSchemaBuilder<A>,
    right: ZodSchemaBuilder<B>,
    errorOrOpts?: string | { error?: string },
  ): ZodIntersectionBuilder<A & B>;
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

    // Schema types
    "zod/string", // #100
    "zod/intersection", // #114

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

        intersection<A, B>(
          left: ZodSchemaBuilder<A>,
          right: ZodSchemaBuilder<B>,
          errorOrOpts?: string | { error?: string },
        ): ZodIntersectionBuilder<A & B> {
          const error = parseError(errorOrOpts);
          return new ZodIntersectionBuilder<A & B>(ctx, [], [], error, {
            left: left.__schemaNode,
            right: right.__schemaNode,
          });
        },
      },
    };
  },
};
