import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod map schemas.
 *
 * Stores key and value schemas as AST nodes in extra fields.
 *
 * @typeParam K - The key type
 * @typeParam V - The value type
 */
export class ZodMapBuilder<K, V> extends ZodSchemaBuilder<Map<K, V>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/map", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodMapBuilder<K, V> {
    return new ZodMapBuilder<K, V>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/**
 * Builder for Zod set schemas with size constraints.
 *
 * Stores value schema as AST node in extra field.
 * Provides min, max, and size check methods.
 *
 * @typeParam T - The element type
 */
export class ZodSetBuilder<T> extends ZodSchemaBuilder<Set<T>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/set", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodSetBuilder<T> {
    return new ZodSetBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Require at least `value` elements. */
  min(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("min_size", { value }, opts) as ZodSetBuilder<T>;
  }

  /** Require at most `value` elements. */
  max(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("max_size", { value }, opts) as ZodSetBuilder<T>;
  }

  /** Require exactly `value` elements. */
  size(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("size", { value }, opts) as ZodSetBuilder<T>;
  }
}
