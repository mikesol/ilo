import type { PluginDefinition } from "@mvfm/core";
import { ZodEnumBuilder, ZodNativeEnumBuilder } from "./enum";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { ZodEnumBuilder, ZodNativeEnumBuilder } from "./enum";
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

/** Parse error config from the standard `errorOrOpts` param. */
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
 */
export interface ZodNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;

  /**
   * Create an enum schema from string values.
   * Validates that input matches one of the provided strings.
   */
  enum<T extends string>(values: T[], errorOrOpts?: string | { error?: string }): ZodEnumBuilder<T>;

  /**
   * Create a native enum schema from a TypeScript enum or object literal.
   * Validates that input matches one of the enum's values.
   */
  nativeEnum<T extends Record<string, string | number>>(
    enumObj: T,
    errorOrOpts?: string | { error?: string },
  ): ZodNativeEnumBuilder<T[keyof T]>;

  // ---- Stubs for future schema types ----
  // Each issue (#102-#120) adds its factory method here.
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
    "zod/enum", // #108
    "zod/native_enum", // #108

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
          return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
        },

        enum<T extends string>(
          values: T[],
          errorOrOpts?: string | { error?: string },
        ): ZodEnumBuilder<T> {
          return new ZodEnumBuilder<T>(ctx, [], [], parseError(errorOrOpts), {
            values,
          });
        },

        nativeEnum<T extends Record<string, string | number>>(
          enumObj: T,
          errorOrOpts?: string | { error?: string },
        ): ZodNativeEnumBuilder<T[keyof T]> {
          return new ZodNativeEnumBuilder<T[keyof T]>(ctx, [], [], parseError(errorOrOpts), {
            entries: enumObj,
          });
        },
      },
    };
  },
};
