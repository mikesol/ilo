import type { PluginDefinition } from "@mvfm/core";
import { ZodRecordBuilder } from "./record";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodRecordBuilder } from "./record";
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

  /** Create a record schema builder (strict mode — exhaustive key check). */
  record<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;

  /** Create a partial record schema builder (non-exhaustive key check). */
  partialRecord<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;

  /** Create a loose record schema builder (non-matching keys pass through). */
  looseRecord<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;
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
    "zod/record", // #115

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
    function buildRecord<K extends string, V>(
      keySchema: ZodSchemaBuilder<K>,
      valueSchema: ZodSchemaBuilder<V>,
      mode: string,
      errorOrOpts?: string | { error?: string },
    ): ZodRecordBuilder<K, V> {
      const error = parseError(errorOrOpts);
      return new ZodRecordBuilder<K, V>(ctx, [], [], error, {
        key: keySchema.__schemaNode,
        value: valueSchema.__schemaNode,
        mode,
      });
    }

    return {
      zod: {
        string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
          const error = parseError(errorOrOpts);
          return new ZodStringBuilder(ctx, [], [], error);
        },

        record<K extends string, V>(
          keySchema: ZodSchemaBuilder<K>,
          valueSchema: ZodSchemaBuilder<V>,
          errorOrOpts?: string | { error?: string },
        ): ZodRecordBuilder<K, V> {
          return buildRecord(keySchema, valueSchema, "strict", errorOrOpts);
        },

        partialRecord<K extends string, V>(
          keySchema: ZodSchemaBuilder<K>,
          valueSchema: ZodSchemaBuilder<V>,
          errorOrOpts?: string | { error?: string },
        ): ZodRecordBuilder<K, V> {
          return buildRecord(keySchema, valueSchema, "partial", errorOrOpts);
        },

        looseRecord<K extends string, V>(
          keySchema: ZodSchemaBuilder<K>,
          valueSchema: ZodSchemaBuilder<V>,
          errorOrOpts?: string | { error?: string },
        ): ZodRecordBuilder<K, V> {
          return buildRecord(keySchema, valueSchema, "loose", errorOrOpts);
        },
      },
    };
  },
};
