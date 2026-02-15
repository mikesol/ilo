import type { PluginDefinition } from "@mvfm/core";
import { type ShapeInput, ZodObjectBuilder } from "./object";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export type { ShapeInput } from "./object";
export { ZodObjectBuilder } from "./object";
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

/** Convert a shape of builders to a shape of AST nodes. */
function shapeToAST(shape: ShapeInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, builder] of Object.entries(shape)) {
    result[key] = builder.__schemaNode;
  }
  return result;
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

  /** Create an object schema from a shape of field builders. */
  object(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;

  /** Create a strict object schema (rejects unknown keys). */
  strictObject(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;

  /** Create a loose object schema (passes unknown keys through). */
  looseObject(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;

  // ---- Stubs for future schema types ----
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
    "zod/object", // #109

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

        object(
          shape: ShapeInput,
          errorOrOpts?: string | { error?: string },
        ): ZodObjectBuilder<Record<string, unknown>> {
          return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
            shape: shapeToAST(shape),
            mode: "strip",
          });
        },

        strictObject(
          shape: ShapeInput,
          errorOrOpts?: string | { error?: string },
        ): ZodObjectBuilder<Record<string, unknown>> {
          return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
            shape: shapeToAST(shape),
            mode: "strict",
          });
        },

        looseObject(
          shape: ShapeInput,
          errorOrOpts?: string | { error?: string },
        ): ZodObjectBuilder<Record<string, unknown>> {
          return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
            shape: shapeToAST(shape),
            mode: "loose",
          });
        },
      },
    };
  },
};
