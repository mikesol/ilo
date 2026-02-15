import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod array schemas.
 *
 * Provides array-specific length constraint methods: min, max, length.
 * The element schema is stored as an AST node in the `element` extra field.
 *
 * @typeParam T - The element type of the array
 */
export class ZodArrayBuilder<T> extends ZodSchemaBuilder<T[]> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/array", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodArrayBuilder<T> {
    return new ZodArrayBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Require at least `value` elements. */
  min(value: number, opts?: { error?: string }): ZodArrayBuilder<T> {
    return this._addCheck("min_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  /** Require at most `value` elements. */
  max(value: number, opts?: { error?: string }): ZodArrayBuilder<T> {
    return this._addCheck("max_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  /** Require exactly `value` elements. */
  length(value: number, opts?: { error?: string }): ZodArrayBuilder<T> {
    return this._addCheck("length", { value }, opts) as ZodArrayBuilder<T>;
  }
}
