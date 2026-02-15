import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

/** A shape mapping field names to schema builders. */
export type ShapeInput = Record<string, ZodSchemaBuilder<unknown>>;

/** Convert a shape of builders to a shape of AST nodes. */
function shapeToAST(shape: ShapeInput): Record<string, SchemaASTNode | WrapperASTNode> {
  const result: Record<string, SchemaASTNode | WrapperASTNode> = {};
  for (const [key, builder] of Object.entries(shape)) {
    result[key] = builder.__schemaNode;
  }
  return result;
}

/**
 * Builder for Zod object schemas.
 *
 * Provides object-specific operations: extend, pick, omit, partial, required.
 * Shape fields are stored as AST nodes in the `shape` extra field.
 *
 * @typeParam T - The object output type
 */
export class ZodObjectBuilder<T extends Record<string, unknown>> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/object", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodObjectBuilder<T> {
    return new ZodObjectBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Extend this object with additional fields. */
  extend(shape: ShapeInput): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    return this._clone({
      extra: { ...this._extra, shape: { ...currentShape, ...shapeToAST(shape) } },
    }) as ZodObjectBuilder<T>;
  }

  /** Pick specific fields from this object. */
  pick(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(mask)) {
      if (key in currentShape) picked[key] = currentShape[key];
    }
    return this._clone({
      extra: { ...this._extra, shape: picked },
    }) as ZodObjectBuilder<T>;
  }

  /** Omit specific fields from this object. */
  omit(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const remaining: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(currentShape)) {
      if (!(key in mask)) remaining[key] = val;
    }
    return this._clone({
      extra: { ...this._extra, shape: remaining },
    }) as ZodObjectBuilder<T>;
  }

  /** Make all or specific fields optional by wrapping them with zod/optional. */
  partial(mask?: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape =
      (this._extra.shape as Record<string, SchemaASTNode | WrapperASTNode>) ?? {};
    const modified: Record<string, SchemaASTNode | WrapperASTNode> = {};
    for (const [key, schema] of Object.entries(currentShape)) {
      if (!mask || key in mask) {
        modified[key] = { kind: "zod/optional", inner: schema };
      } else {
        modified[key] = schema;
      }
    }
    return this._clone({
      extra: { ...this._extra, shape: modified },
    }) as ZodObjectBuilder<T>;
  }

  /** Make all or specific fields required by unwrapping zod/optional. */
  required(mask?: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape =
      (this._extra.shape as Record<string, SchemaASTNode | WrapperASTNode>) ?? {};
    const modified: Record<string, SchemaASTNode | WrapperASTNode> = {};
    for (const [key, schema] of Object.entries(currentShape)) {
      if (!mask || key in mask) {
        // Unwrap optional if present
        if (schema.kind === "zod/optional" && "inner" in schema) {
          modified[key] = schema.inner as SchemaASTNode | WrapperASTNode;
        } else {
          modified[key] = schema;
        }
      } else {
        modified[key] = schema;
      }
    }
    return this._clone({
      extra: { ...this._extra, shape: modified },
    }) as ZodObjectBuilder<T>;
  }

  /** Set a catchall schema for unknown keys. */
  catchall(schema: ZodSchemaBuilder<unknown>): ZodObjectBuilder<T> {
    return this._clone({
      extra: { ...this._extra, catchall: schema.__schemaNode },
    }) as ZodObjectBuilder<T>;
  }
}
