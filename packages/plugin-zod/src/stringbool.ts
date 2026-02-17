import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodStringBoolNode extends ZodSchemaNodeBase {
  kind: "zod/stringbool";
  truthy?: string[];
  falsy?: string[];
  caseSensitive?: boolean;
}

/**
 * Builder for Zod stringbool schemas.
 *
 * Converts string values to boolean based on configurable truthy/falsy lists.
 * Default truthy: "true", "1", "yes", "on", "y", "enabled"
 * Default falsy: "false", "0", "no", "off", "n", "disabled"
 */
export class ZodStringBoolBuilder extends ZodSchemaBuilder<boolean> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/stringbool", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodStringBoolBuilder {
    return new ZodStringBoolBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the stringbool schema. */
export const stringboolNodeKinds: string[] = ["zod/stringbool"];

/**
 * Namespace fragment for stringbool schema factories.
 */
export interface ZodStringBoolNamespace {
  /**
   * Create a stringbool schema that coerces strings to booleans.
   *
   * @example
   * ```ts
   * $.zod.stringbool()
   * // "true"/"1"/"yes"/"on"/"y"/"enabled" → true
   * // "false"/"0"/"no"/"off"/"n"/"disabled" → false
   *
   * $.zod.stringbool({ truthy: ["yes", "y"], falsy: ["no", "n"], caseSensitive: true })
   * // Custom truthy/falsy values with case sensitivity
   * ```
   */
  stringbool(opts?: {
    truthy?: string[];
    falsy?: string[];
    caseSensitive?: boolean;
  }): ZodStringBoolBuilder;
}

/** Build the stringbool namespace factory methods. */
export function stringboolNamespace(ctx: PluginContext): ZodStringBoolNamespace {
  return {
    stringbool(opts?: {
      truthy?: string[];
      falsy?: string[];
      caseSensitive?: boolean;
    }): ZodStringBoolBuilder {
      const extra: Record<string, unknown> = {};
      if (opts?.truthy) extra.truthy = opts.truthy;
      if (opts?.falsy) extra.falsy = opts.falsy;
      if (opts?.caseSensitive !== undefined) extra.caseSensitive = opts.caseSensitive;
      return new ZodStringBoolBuilder(ctx, [], [], undefined, extra);
    },
  };
}

/** Interpreter handlers for stringbool schema nodes. */
export const stringboolInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/stringbool": async function* (
    node: ZodStringBoolNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const opts: Record<string, unknown> = {};
    if (node.truthy) opts.truthy = node.truthy;
    if (node.falsy) opts.falsy = node.falsy;
    if (node.caseSensitive !== undefined) {
      opts.case = node.caseSensitive ? "sensitive" : "insensitive";
    }
    return z.stringbool(Object.keys(opts).length > 0 ? opts : undefined);
  },
};
