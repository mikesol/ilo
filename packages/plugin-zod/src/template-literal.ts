import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodTemplateLiteralNode extends ZodSchemaNodeBase {
  kind: "zod/template_literal";
  parts: (string | ZodSchemaNodeBase)[];
}

/**
 * Builder for Zod template literal schemas.
 *
 * Produces a schema that validates strings matching a template literal pattern
 * with static and dynamic parts.
 *
 * @typeParam T - The template literal type this schema validates to
 */
export class ZodTemplateLiteralBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/template_literal", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodTemplateLiteralBuilder<T> {
    return new ZodTemplateLiteralBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the template literal schema. */
export const templateLiteralNodeKinds: string[] = ["zod/template_literal"];

/**
 * Namespace fragment for template literal schema factories.
 */
export interface ZodTemplateLiteralNamespace {
  /**
   * Create a template literal schema.
   *
   * @example
   * ```ts
   * $.zod.templateLiteral(["hello, ", $.zod.string(), "!"])
   * // type: `hello, ${string}!`
   *
   * $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])])
   * // type: `${number}px` | `${number}em` | `${number}rem`
   * ```
   */
  templateLiteral<T extends string>(
    parts: (string | ZodSchemaBuilder<any>)[],
  ): ZodTemplateLiteralBuilder<T>;
}

/** Build the template literal namespace factory methods. */
export function templateLiteralNamespace(ctx: PluginContext): ZodTemplateLiteralNamespace {
  return {
    templateLiteral<T extends string>(
      parts: (string | ZodSchemaBuilder<any>)[],
    ): ZodTemplateLiteralBuilder<T> {
      const normalizedParts = parts.map((part) =>
        typeof part === "string" ? part : part.__schemaNode,
      );
      return new ZodTemplateLiteralBuilder<T>(ctx, [], [], undefined, {
        parts: normalizedParts,
      });
    },
  };
}

/**
 * Build a Zod schema from an AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: ZodSchemaNodeBase) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create template literal interpreter handlers with access to the shared schema builder. */
export function createTemplateLiteralInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/template_literal": async function* (
      node: ZodTemplateLiteralNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const parts: (string | z.ZodType)[] = [];
      for (const part of node.parts) {
        if (typeof part === "string") {
          parts.push(part);
        } else {
          // It's a schema node - recursively build it
          parts.push(yield* buildSchema(part));
        }
      }
      return z.templateLiteral(parts as any);
    },
  };
}
