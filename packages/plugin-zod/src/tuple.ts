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
 * Builder for Zod tuple schemas.
 *
 * Represents fixed-length typed arrays with optional variadic rest element.
 * Items are stored as AST nodes in the `items` extra field, and the optional
 * rest element in the `rest` extra field.
 *
 * @typeParam T - The tuple output type
 */
export class ZodTupleBuilder<T extends unknown[]> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/tuple", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodTupleBuilder<T> {
    return new ZodTupleBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Convert an array of schema builders to an array of AST nodes. */
export function itemsToAST(items: ZodSchemaBuilder<unknown>[]): (SchemaASTNode | WrapperASTNode)[] {
  return items.map((builder) => builder.__schemaNode);
}
