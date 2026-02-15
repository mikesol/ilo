import type { PluginDefinition } from "@mvfm/core";
import { ZodMapBuilder, ZodSetBuilder } from "./map-set";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodMapBuilder, ZodSetBuilder } from "./map-set";
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

  /** Create a map schema builder. */
  map<K, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodMapBuilder<K, V>;

  /** Create a set schema builder with optional size constraints. */
  set<T>(
    valueSchema: ZodSchemaBuilder<T>,
    errorOrOpts?: string | { error?: string },
  ): ZodSetBuilder<T>;
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
    "zod/map", // #116
    "zod/set", // #116

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

        map<K, V>(
          keySchema: ZodSchemaBuilder<K>,
          valueSchema: ZodSchemaBuilder<V>,
          errorOrOpts?: string | { error?: string },
        ): ZodMapBuilder<K, V> {
          const error = parseError(errorOrOpts);
          return new ZodMapBuilder<K, V>(ctx, [], [], error, {
            key: keySchema.__schemaNode,
            value: valueSchema.__schemaNode,
          });
        },

        set<T>(
          valueSchema: ZodSchemaBuilder<T>,
          errorOrOpts?: string | { error?: string },
        ): ZodSetBuilder<T> {
          const error = parseError(errorOrOpts);
          return new ZodSetBuilder<T>(ctx, [], [], error, {
            value: valueSchema.__schemaNode,
          });
        },
      },
    };
  },
};
