import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

interface ZodLazyNode extends ZodSchemaNodeBase {
  kind: "zod/lazy";
  schema: AnyZodSchemaNode;
}

/**
 * Builder for Zod lazy schemas.
 *
 * Supports recursive and mutually recursive schemas by wrapping
 * the schema in a getter function (`z.lazy(() => schema)`).
 *
 * The lazy builder defers evaluating the schema getter function until
 * the schema node is actually accessed, allowing for circular references.
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodLazyBuilder<T> extends ZodSchemaBuilder<T> {
  private _lazyFn?: () => ZodSchemaBuilder<T>;
  private _resolvedSchema?: AnyZodSchemaNode;

  constructor(
    ctx: PluginContext,
    lazyFn: () => ZodSchemaBuilder<T>,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/lazy", checks, refinements, error, extra);
    this._lazyFn = lazyFn;
  }

  /** Override to lazily evaluate the schema function. */
  get __schemaNode(): SchemaASTNode {
    if (!this._resolvedSchema && this._lazyFn) {
      // Call the function now that all variables should be initialized
      const result = this._lazyFn();
      this._resolvedSchema = result.__schemaNode as AnyZodSchemaNode;
      this._lazyFn = undefined; // Clear to allow GC
    }
    
    const baseNode = super.__schemaNode as ZodSchemaNodeBase;
    return {
      ...baseNode,
      schema: this._resolvedSchema,
    } as SchemaASTNode;
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodLazyBuilder<T> {
    return new ZodLazyBuilder<T>(
      this._ctx,
      this._lazyFn ?? (() => ({ __schemaNode: this._resolvedSchema } as ZodSchemaBuilder<T>)),
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the lazy schema. */
export const lazyNodeKinds: string[] = ["zod/lazy"];

/**
 * Namespace fragment for lazy schema factories.
 */
export interface ZodLazyNamespace {
  /**
   * Create a lazy schema for recursive or mutually recursive structures.
   *
   * @example
   * ```ts
   * const Category = $.zod.object({
   *   name: $.zod.string(),
   *   subcategories: $.zod.lazy(() => $.zod.array(Category))
   * });
   * ```
   */
  lazy<T>(fn: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T>;
}

/** Build the lazy namespace factory methods. */
export function lazyNamespace(ctx: PluginContext): ZodLazyNamespace {
  return {
    lazy<T>(fn: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T> {
      return new ZodLazyBuilder<T>(ctx, fn);
    },
  };
}
