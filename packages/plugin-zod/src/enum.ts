import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod enum schemas.
 *
 * Validates that input is one of a fixed set of string values.
 * Supports `.extract()` and `.exclude()` for deriving sub-enums.
 *
 * @typeParam T - Union of the allowed string values
 */
export class ZodEnumBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodEnumBuilder<T> {
    return new ZodEnumBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Create a new enum with only the specified values. */
  extract<U extends T>(values: U[]): ZodEnumBuilder<U> {
    return new ZodEnumBuilder<U>(this._ctx, [], [], this._error, {
      ...this._extra,
      values,
    });
  }

  /** Create a new enum without the specified values. */
  exclude<U extends T>(values: U[]): ZodEnumBuilder<Exclude<T, U>> {
    const current = (this._extra.values as T[]) ?? [];
    const remaining = current.filter((v) => !values.includes(v as U));
    return new ZodEnumBuilder<Exclude<T, U>>(this._ctx, [], [], this._error, {
      ...this._extra,
      values: remaining,
    });
  }
}

/**
 * Builder for Zod native enum schemas.
 *
 * Validates that input is one of the values from a TypeScript enum
 * or object literal with string/number values.
 *
 * @typeParam T - The output type (union of enum values)
 */
export class ZodNativeEnumBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/native_enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodNativeEnumBuilder<T> {
    return new ZodNativeEnumBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}
