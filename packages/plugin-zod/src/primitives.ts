import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

/**
 * Builder for simple Zod primitive schemas with no type-specific methods.
 */
export class ZodPrimitiveBuilder<T> extends ZodSchemaBuilder<T> {
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
  }): ZodPrimitiveBuilder<T> {
    return new ZodPrimitiveBuilder<T>(
      this._kind,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export const primitivesNodeKinds: string[] = [
  "zod/boolean",
  "zod/null",
  "zod/undefined",
  "zod/void",
  "zod/symbol",
];

export interface ZodPrimitivesNamespace {
  boolean(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<boolean>;
  null(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<null>;
  undefined(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<undefined>;
  void(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<void>;
  symbol(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<symbol>;
}

export function primitivesNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodPrimitivesNamespace {
  return {
    boolean: (e) => new ZodPrimitiveBuilder<boolean>("zod/boolean", [], [], parseError(e)),
    null: (e) => new ZodPrimitiveBuilder<null>("zod/null", [], [], parseError(e)),
    undefined: (e) => new ZodPrimitiveBuilder<undefined>("zod/undefined", [], [], parseError(e)),
    void: (e) => new ZodPrimitiveBuilder<void>("zod/void", [], [], parseError(e)),
    symbol: (e) => new ZodPrimitiveBuilder<symbol>("zod/symbol", [], [], parseError(e)),
  };
}

export const primitivesInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/boolean": async function* (node: ZodSchemaNodeBase) {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.boolean({ error: errorFn }) : z.boolean();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/null": async function* () {
    return z.null();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/undefined": async function* () {
    return z.undefined();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/void": async function* () {
    return z.void();
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "zod/symbol": async function* () {
    return z.symbol();
  },
};
