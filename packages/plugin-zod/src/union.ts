import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

/**
 * Builder for Zod union and exclusive-or (xor) schemas.
 *
 * Stores option schemas as AST nodes in the `options` extra field.
 * Used for both `$.zod.union(...)` and `$.zod.xor(...)`.
 *
 * @typeParam T - The union output type
 */
export class ZodUnionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    kind: "zod/union" | "zod/xor",
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodUnionBuilder<T> {
    return new ZodUnionBuilder<T>(
      this._ctx,
      this._kind as "zod/union" | "zod/xor",
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Convert an array of schema builders to an array of AST nodes. */
export function optionsToAST(
  options: ZodSchemaBuilder<unknown>[],
): (SchemaASTNode | WrapperASTNode)[] {
  return options.map((builder) => builder.__schemaNode);
}
