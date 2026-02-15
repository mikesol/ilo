import type { PluginDefinition } from "@mvfm/core";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodStringBuilder } from "./string";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";

/**
 * ISO date/time format namespace within the Zod plugin.
 */
export interface ZodIsoNamespace {
  /** ISO date format (YYYY-MM-DD). */
  date(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ISO time format. */
  time(
    errorOrOpts?:
      | string
      | { error?: string; precision?: number; offset?: boolean; local?: boolean },
  ): ZodStringBuilder;
  /** ISO datetime format. */
  datetime(
    errorOrOpts?:
      | string
      | { error?: string; precision?: number; offset?: boolean; local?: boolean },
  ): ZodStringBuilder;
  /** ISO duration format. */
  duration(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
}

/**
 * The `$.zod` namespace contributed by the Zod plugin.
 *
 * Provides factory methods for creating Zod schema builders:
 * `$.zod.string()`, `$.zod.number()`, `$.zod.object(...)`, etc.
 *
 * Each factory returns a schema builder with chainable methods
 * for adding checks, refinements, and wrappers. Call `.parse()`
 * or `.safeParse()` to produce a validation AST node.
 */
export interface ZodNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;

  // ---- String format constructors (#101) ----

  /** Email format. */
  email(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** UUID format. */
  uuid(errorOrOpts?: string | { error?: string; version?: number }): ZodStringBuilder;
  /** UUID v4 shortcut. */
  uuidv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** UUID v7 shortcut. */
  uuidv7(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** GUID (loose UUID). */
  guid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** URL format. */
  url(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** HTTP URL (http/https only). */
  httpUrl(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hostname format. */
  hostname(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Emoji format. */
  emoji(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Base64 format. */
  base64(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Base64 URL-safe format. */
  base64url(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hexadecimal format. */
  hex(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** JWT format. */
  jwt(errorOrOpts?: string | { error?: string; alg?: string }): ZodStringBuilder;
  /** Nano ID format. */
  nanoid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CUID format. */
  cuid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CUID2 format. */
  cuid2(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ULID format. */
  ulid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** IPv4 format. */
  ipv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** IPv6 format. */
  ipv6(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** MAC address format. */
  mac(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CIDR v4 format. */
  cidrv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CIDR v6 format. */
  cidrv6(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hash format (sha256, md5, etc). */
  hash(algorithm: string, errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** E.164 phone number format. */
  e164(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ISO date/time formats. */
  iso: ZodIsoNamespace;

  // ---- Stubs for future schema types ----
  // number, bigint, boolean, etc. added by other issues
}

/** Parse error config from the standard `errorOrOpts` param. */
function parseError(errorOrOpts?: string | { error?: string }): string | undefined {
  return typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
}

/** Create a string builder with a format descriptor in extra. */
function formatBuilder(
  ctx: any,
  format: Record<string, unknown>,
  errorOrOpts?: string | { error?: string },
): ZodStringBuilder {
  return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts), { format });
}

/**
 * Zod validation DSL plugin for mvfm.
 *
 * Adds the `$.zod` namespace to the dollar object, providing factory
 * methods for building Zod-compatible validation schemas as AST nodes.
 * The default interpreter reconstructs actual Zod schemas at runtime.
 *
 * Requires `zod` v4+ as a peer dependency.
 */
export const zod: PluginDefinition<{ zod: ZodNamespace }> = {
  name: "zod",

  nodeKinds: [
    // Parsing operations (#96)
    "zod/parse",
    "zod/safe_parse",
    "zod/parse_async",
    "zod/safe_parse_async",

    // Schema types — each issue adds its kinds here
    "zod/string", // #100 + #101 (formats use zod/string with format field)

    // Wrappers (#99)
    "zod/optional",
    "zod/nullable",
    "zod/nullish",
    "zod/nonoptional",
    "zod/default",
    "zod/prefault",
    "zod/catch",
    "zod/readonly",
    "zod/branded",
  ],

  build(ctx) {
    return {
      zod: {
        string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
          return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
        },

        // ---- String format constructors (#101) ----
        email(errorOrOpts) {
          return formatBuilder(ctx, { type: "email" }, errorOrOpts);
        },
        uuid(errorOrOpts) {
          const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
          return formatBuilder(
            ctx,
            { type: "uuid", ...(opts?.version != null ? { version: (opts as any).version } : {}) },
            errorOrOpts,
          );
        },
        uuidv4(errorOrOpts) {
          return formatBuilder(ctx, { type: "uuidv4" }, errorOrOpts);
        },
        uuidv7(errorOrOpts) {
          return formatBuilder(ctx, { type: "uuidv7" }, errorOrOpts);
        },
        guid(errorOrOpts) {
          return formatBuilder(ctx, { type: "guid" }, errorOrOpts);
        },
        url(errorOrOpts) {
          return formatBuilder(ctx, { type: "url" }, errorOrOpts);
        },
        httpUrl(errorOrOpts) {
          return formatBuilder(ctx, { type: "httpUrl" }, errorOrOpts);
        },
        hostname(errorOrOpts) {
          return formatBuilder(ctx, { type: "hostname" }, errorOrOpts);
        },
        emoji(errorOrOpts) {
          return formatBuilder(ctx, { type: "emoji" }, errorOrOpts);
        },
        base64(errorOrOpts) {
          return formatBuilder(ctx, { type: "base64" }, errorOrOpts);
        },
        base64url(errorOrOpts) {
          return formatBuilder(ctx, { type: "base64url" }, errorOrOpts);
        },
        hex(errorOrOpts) {
          return formatBuilder(ctx, { type: "hex" }, errorOrOpts);
        },
        jwt(errorOrOpts) {
          const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
          return formatBuilder(
            ctx,
            { type: "jwt", ...(opts?.alg != null ? { alg: (opts as any).alg } : {}) },
            errorOrOpts,
          );
        },
        nanoid(errorOrOpts) {
          return formatBuilder(ctx, { type: "nanoid" }, errorOrOpts);
        },
        cuid(errorOrOpts) {
          return formatBuilder(ctx, { type: "cuid" }, errorOrOpts);
        },
        cuid2(errorOrOpts) {
          return formatBuilder(ctx, { type: "cuid2" }, errorOrOpts);
        },
        ulid(errorOrOpts) {
          return formatBuilder(ctx, { type: "ulid" }, errorOrOpts);
        },
        ipv4(errorOrOpts) {
          return formatBuilder(ctx, { type: "ipv4" }, errorOrOpts);
        },
        ipv6(errorOrOpts) {
          return formatBuilder(ctx, { type: "ipv6" }, errorOrOpts);
        },
        mac(errorOrOpts) {
          return formatBuilder(ctx, { type: "mac" }, errorOrOpts);
        },
        cidrv4(errorOrOpts) {
          return formatBuilder(ctx, { type: "cidrv4" }, errorOrOpts);
        },
        cidrv6(errorOrOpts) {
          return formatBuilder(ctx, { type: "cidrv6" }, errorOrOpts);
        },
        hash(algorithm: string, errorOrOpts) {
          return formatBuilder(ctx, { type: "hash", algorithm }, errorOrOpts);
        },
        e164(errorOrOpts) {
          return formatBuilder(ctx, { type: "e164" }, errorOrOpts);
        },
        iso: {
          date(errorOrOpts) {
            return formatBuilder(ctx, { type: "iso.date" }, errorOrOpts);
          },
          time(errorOrOpts) {
            const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
            const fmt: Record<string, unknown> = { type: "iso.time" };
            if (opts?.precision != null) fmt.precision = (opts as any).precision;
            if (opts?.offset != null) fmt.offset = (opts as any).offset;
            if (opts?.local != null) fmt.local = (opts as any).local;
            return formatBuilder(ctx, fmt, errorOrOpts);
          },
          datetime(errorOrOpts) {
            const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
            const fmt: Record<string, unknown> = { type: "iso.datetime" };
            if (opts?.precision != null) fmt.precision = (opts as any).precision;
            if (opts?.offset != null) fmt.offset = (opts as any).offset;
            if (opts?.local != null) fmt.local = (opts as any).local;
            return formatBuilder(ctx, fmt, errorOrOpts);
          },
          duration(errorOrOpts) {
            return formatBuilder(ctx, { type: "iso.duration" }, errorOrOpts);
          },
        },
      },
    };
  },
};
