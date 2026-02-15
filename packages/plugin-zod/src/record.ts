import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/** Record mode: strict (exhaustive), partial (non-exhaustive), or loose (pass-through). */
export type RecordMode = "strict" | "partial" | "loose";

/**
 * Builder for Zod record schemas.
 *
 * Stores key and value schemas as AST nodes in extra fields,
 * along with a mode field for strict/partial/loose behavior.
 *
 * @typeParam K - The key type
 * @typeParam V - The value type
 */
export class ZodRecordBuilder<K extends string, V> extends ZodSchemaBuilder<Record<K, V>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/record", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodRecordBuilder<K, V> {
    return new ZodRecordBuilder<K, V>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}
