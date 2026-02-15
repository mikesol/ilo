import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod string schemas.
 *
 * Provides string-specific validations (min, max, regex, etc.) and
 * transforms (trim, toLowerCase, toUpperCase) on top of the common
 * base methods (parse, safeParse, refine, optional, etc.).
 */
export class ZodStringBuilder extends ZodSchemaBuilder<string> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/string", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodStringBuilder {
    return new ZodStringBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  // ---- Length validations ----

  /** Minimum length. Produces `min_length` check descriptor. */
  min(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("min_length", { value: length }, opts);
  }

  /** Maximum length. Produces `max_length` check descriptor. */
  max(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("max_length", { value: length }, opts);
  }

  /** Exact length. Produces `length` check descriptor. */
  length(
    len: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("length", { value: len }, opts);
  }

  // ---- Pattern matching ----

  /** Regex match. Produces `regex` check descriptor. */
  regex(
    pattern: RegExp,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("regex", { pattern: pattern.source, flags: pattern.flags }, opts);
  }

  // ---- Substring checks ----

  /** Must start with prefix. Produces `starts_with` check descriptor. */
  startsWith(
    prefix: string,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("starts_with", { value: prefix }, opts);
  }

  /** Must end with suffix. Produces `ends_with` check descriptor. */
  endsWith(
    suffix: string,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("ends_with", { value: suffix }, opts);
  }

  /** Must contain substring. Produces `includes` check descriptor. */
  includes(
    substring: string,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("includes", { value: substring }, opts);
  }

  // ---- Case checks ----

  /** Must be all uppercase. Produces `uppercase` check descriptor. */
  uppercase(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodStringBuilder {
    return this._addCheck("uppercase", {}, opts);
  }

  /** Must be all lowercase. Produces `lowercase` check descriptor. */
  lowercase(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodStringBuilder {
    return this._addCheck("lowercase", {}, opts);
  }

  // ---- Transforms ----

  /** Trim whitespace. Produces `trim` check descriptor. */
  trim(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodStringBuilder {
    return this._addCheck("trim", {}, opts);
  }

  /** Convert to lowercase. Produces `to_lower_case` check descriptor. */
  toLowerCase(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodStringBuilder {
    return this._addCheck("to_lower_case", {}, opts);
  }

  /** Convert to uppercase. Produces `to_upper_case` check descriptor. */
  toUpperCase(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodStringBuilder {
    return this._addCheck("to_upper_case", {}, opts);
  }

  /** Unicode normalize. Produces `normalize` check descriptor. */
  normalize(
    form?: "NFC" | "NFD" | "NFKC" | "NFKD",
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("normalize", { form: form ?? "NFC" }, opts);
  }
}
