import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import { z } from "zod";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  // ASTNode error config — would need interpreter context to evaluate.
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodString {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number, errOpt);
        break;
      case "max_length":
        s = s.max(check.value as number, errOpt);
        break;
      // Additional string checks will be added by #137
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build a Zod string-format schema from a format descriptor.
 * Maps format type strings to the corresponding Zod format constructors.
 */
function buildStringFormat(
  format: Record<string, unknown>,
  errorFn?: (iss: unknown) => string,
): z.ZodString {
  const errOpt = errorFn ? { error: errorFn } : {};
  switch (format.type) {
    case "email":
      return z.email(errOpt) as unknown as z.ZodString;
    case "uuid":
      return z.uuid(
        format.version != null
          ? {
              ...errOpt,
              version: format.version as "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8",
            }
          : errOpt,
      ) as unknown as z.ZodString;
    case "uuidv4":
      return z.uuidv4(errOpt) as unknown as z.ZodString;
    case "uuidv7":
      return z.uuidv7(errOpt) as unknown as z.ZodString;
    case "guid":
      return z.guid(errOpt) as unknown as z.ZodString;
    case "url":
      return z.url(errOpt) as unknown as z.ZodString;
    case "httpUrl":
      return z.httpUrl(errOpt) as unknown as z.ZodString;
    case "hostname":
      return z.hostname(errOpt) as unknown as z.ZodString;
    case "emoji":
      return z.emoji(errOpt) as unknown as z.ZodString;
    case "base64":
      return z.base64(errOpt) as unknown as z.ZodString;
    case "base64url":
      return z.base64url(errOpt) as unknown as z.ZodString;
    case "hex":
      return z.hex(errOpt) as unknown as z.ZodString;
    case "jwt":
      return z.jwt(
        format.alg != null ? { ...errOpt, alg: format.alg as string } : errOpt,
      ) as unknown as z.ZodString;
    case "nanoid":
      return z.nanoid(errOpt) as unknown as z.ZodString;
    case "cuid":
      return z.cuid(errOpt) as unknown as z.ZodString;
    case "cuid2":
      return z.cuid2(errOpt) as unknown as z.ZodString;
    case "ulid":
      return z.ulid(errOpt) as unknown as z.ZodString;
    case "ipv4":
      return z.ipv4(errOpt) as unknown as z.ZodString;
    case "ipv6":
      return z.ipv6(errOpt) as unknown as z.ZodString;
    case "mac":
      return z.mac(errOpt) as unknown as z.ZodString;
    case "cidrv4":
      return z.cidrv4(errOpt) as unknown as z.ZodString;
    case "cidrv6":
      return z.cidrv6(errOpt) as unknown as z.ZodString;
    case "hash":
      return z.hash(
        format.algorithm as "md5" | "sha1" | "sha256" | "sha384" | "sha512",
        errOpt,
      ) as unknown as z.ZodString;
    case "e164":
      return z.e164(errOpt) as unknown as z.ZodString;
    case "iso.date":
      return z.iso.date(errOpt) as unknown as z.ZodString;
    case "iso.time": {
      const opts: Record<string, unknown> = { ...errOpt };
      if (format.precision != null) opts.precision = format.precision;
      if (format.offset != null) opts.offset = format.offset;
      if (format.local != null) opts.local = format.local;
      return z.iso.time(opts as any) as unknown as z.ZodString;
    }
    case "iso.datetime": {
      const opts: Record<string, unknown> = { ...errOpt };
      if (format.precision != null) opts.precision = format.precision;
      if (format.offset != null) opts.offset = format.offset;
      if (format.local != null) opts.local = format.local;
      return z.iso.datetime(opts as any) as unknown as z.ZodString;
    }
    case "iso.duration":
      return z.iso.duration(errOpt) as unknown as z.ZodString;
    default:
      throw new Error(`Zod interpreter: unknown string format "${format.type}"`);
  }
}

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Yields recurse effects for value-carrying wrappers (default, prefault, catch).
 * Simple schema types and non-value wrappers are handled synchronously.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  switch (node.kind) {
    case "zod/string": {
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const format = node.format as Record<string, unknown> | undefined;
      const base = format
        ? buildStringFormat(format, errorFn)
        : errorFn
          ? z.string({ error: errorFn })
          : z.string();
      return applyStringChecks(base, checks);
    }

    // Simple wrappers (no value field)
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner as ASTNode) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner as ASTNode)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner as ASTNode)).brand(node.brand as string);

    // Value-carrying wrappers — evaluate the value AST node via recurse
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.catch(value);
    }

    // Additional schema types will be added by colocated interpreter issues
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 * In Zod v4, parse-level errors must be functions.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 * Refinements live on the base schema node, not on wrappers.
 */
function extractRefinements(schemaNode: ASTNode): RefinementDescriptor[] {
  return (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
}

/**
 * Apply refinement descriptors to a validated value via the generator pipeline.
 * Each refinement's lambda body is cloned, injected with the current value,
 * and evaluated through the interpreter via recurse effects.
 *
 * - `refine` / `check`: predicate must return truthy, else throw
 * - `overwrite`: result replaces the current value
 * - `super_refine`: evaluated for side effects (e.g. adding issues)
 */
function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): Generator<StepEffect, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { name: string }; body: ASTNode };
    const bodyClone = structuredClone(lambda.body);
    injectLambdaParam(bodyClone, lambda.param.name, current);
    const result = yield { type: "recurse", child: bodyClone };

    switch (ref.kind) {
      case "refine":
      case "check":
        if (!result) {
          throw new Error(typeof ref.error === "string" ? ref.error : "Refinement failed");
        }
        break;
      case "overwrite":
        current = result;
        break;
      case "super_refine":
        // Evaluated for side effects; return value ignored
        break;
    }
  }
  return current;
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * Schema nodes (zod/string, etc.) are handled by `buildSchemaGen` which
 * constructs actual Zod schemas from AST descriptors, yielding recurse
 * effects for value-carrying wrappers.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
