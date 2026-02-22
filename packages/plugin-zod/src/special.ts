import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

/**
 * Builder for simple Zod schema types with no type-specific methods.
 */
export class ZodSimpleBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodSimpleBuilder<T> {
    return new ZodSimpleBuilder<T>(
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
 */
export function buildPromise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>> {
  const wrapperNode: WrapperASTNode = {
    kind: "zod/promise",
    inner: inner.__schemaNode,
  };
  return new ZodWrappedBuilder<Promise<T>>(wrapperNode);
}

/**
 * Build a custom schema with a DSL predicate callback.
 */
export function buildCustom<T>(
  fn: (val: CExpr<unknown>) => CExpr<boolean>,
  errorOrOpts?: string | { error?: string },
): ZodSimpleBuilder<T> {
  const param = makeCExpr<unknown, "core/lambda_param", []>("core/lambda_param", []);
  const result = fn(param);
  const body = isCExpr(result) ? result : param;
  const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
  return new ZodSimpleBuilder<T>("zod/custom", [], [], error, {
    predicate: { param, body },
  });
}

export const specialNodeKinds: string[] = [
  "zod/any",
  "zod/unknown",
  "zod/never",
  "zod/promise",
  "zod/custom",
];

export interface ZodSpecialNamespace {
  any(): ZodSimpleBuilder<any>;
  unknown(): ZodSimpleBuilder<unknown>;
  never(): ZodSimpleBuilder<never>;
  promise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>>;
  custom<T = unknown>(
    fn: (val: CExpr<unknown>) => CExpr<boolean>,
    errorOrOpts?: string | { error?: string },
  ): ZodSimpleBuilder<T>;
}

export function specialNamespace(
  _parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodSpecialNamespace {
  return {
    any: () => new ZodSimpleBuilder<any>("zod/any"),
    unknown: () => new ZodSimpleBuilder<unknown>("zod/unknown"),
    never: () => new ZodSimpleBuilder<never>("zod/never"),
    promise: <T>(inner: ZodSchemaBuilder<T>) => buildPromise(inner),
    custom: <T = unknown>(
      fn: (val: CExpr<unknown>) => CExpr<boolean>,
      errorOrOpts?: string | { error?: string },
    ) => buildCustom<T>(fn, errorOrOpts),
  };
}

export const specialInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/any": async function* () {
    return z.any();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/unknown": async function* () {
    return z.unknown();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/never": async function* () {
    return z.never();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/custom": async function* () {
    return z.any();
  },
};
