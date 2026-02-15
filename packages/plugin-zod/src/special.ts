import type { ASTNode, Expr, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor, WrapperASTNode } from "./types";

/**
 * Builder for simple Zod schema types with no type-specific methods.
 *
 * Used for `any`, `unknown`, `never`, and `nan` schemas.
 * These schemas have no additional check methods — only the
 * inherited base methods (parse, safeParse, refine, optional, etc.).
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodSimpleBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    kind: string,
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
  }): ZodSimpleBuilder<T> {
    return new ZodSimpleBuilder<T>(
      this._ctx,
      this._kind,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/**
 * Build a promise schema wrapper around an inner schema.
 * Produces a `zod/promise` wrapper node.
 */
export function buildPromise<T>(
  ctx: PluginContext,
  inner: ZodSchemaBuilder<T>,
): ZodWrappedBuilder<Promise<T>> {
  const wrapperNode: WrapperASTNode = {
    kind: "zod/promise",
    inner: inner.__schemaNode,
  };
  return new ZodWrappedBuilder<Promise<T>>(ctx, wrapperNode);
}

/**
 * Build a custom schema with a DSL predicate callback.
 * The callback receives an `Expr<unknown>` placeholder and must return
 * an `Expr<boolean>` built from DSL operations.
 */
export function buildCustom<T>(
  ctx: PluginContext,
  fn: (val: Expr<unknown>) => Expr<boolean>,
  errorOrOpts?: string | { error?: string },
): ZodSimpleBuilder<T> {
  const paramNode: ASTNode = { kind: "core/lambda_param", name: "custom_val" };
  const paramProxy = ctx.expr<unknown>(paramNode);
  const result = fn(paramProxy);
  const bodyNode = ctx.isExpr(result) ? result.__node : paramNode;
  const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
  return new ZodSimpleBuilder<T>(ctx, "zod/custom", [], [], error, {
    predicate: { kind: "core/lambda", param: paramNode, body: bodyNode },
  });
}
