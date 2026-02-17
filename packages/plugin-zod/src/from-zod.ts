import type { PluginContext } from "@mvfm/core";
import { z } from "zod";
import { ZodArrayBuilder } from "./array";
import type { ZodSchemaBuilder } from "./base";
import { ZodWrappedBuilder } from "./base";
import { ZodBigIntBuilder } from "./bigint";
import { ZodDateBuilder } from "./date";
import { ZodEnumBuilder } from "./enum";
import { ZodLiteralBuilder } from "./literal";
import { ZodNumberBuilder } from "./number";
import { ZodObjectBuilder } from "./object";
import { ZodPrimitiveBuilder } from "./primitives";
import { ZodRecordBuilder } from "./record";
import { ZodStringBuilder } from "./string";
import { ZodTupleBuilder } from "./tuple";
import { ZodUnionBuilder } from "./union";
import type { CheckDescriptor } from "./types";

/**
 * Converts a Zod schema into a schema builder that can be used with mvfm.
 *
 * Walks the Zod schema's internal structure and maps each Zod type to
 * the corresponding mvfm zod builder. Throws an error if the schema
 * contains unconvertible constructs (closures, async transforms, etc.).
 *
 * @param zodSchema - The Zod schema to convert
 * @param ctx - Plugin context for creating builders
 * @returns Schema builder representing the Zod schema
 * @throws Error if the schema contains unconvertible constructs
 *
 * @example
 * ```ts
 * const prog = app(($) => {
 *   const userSchema = $.zod.fromZod(z.object({
 *     name: z.string().min(1),
 *     age: z.number().min(0),
 *   }));
 *   return userSchema.parse($.input);
 * });
 * ```
 */
export function fromZod(
  zodSchema: z.ZodType,
  ctx: PluginContext,
): ZodSchemaBuilder<any> {
  const def = (zodSchema as any)._def;
  const schema = zodSchema as any;

  if (!def || !def.type) {
    throw new Error("fromZod: Invalid Zod schema - missing _def.type");
  }

  // Check for unconvertible constructs
  if (def.type === "pipe") {
    throw new Error(
      "fromZod: Zod transforms with functions (.transform, .pipe) cannot be converted to AST. " +
        "These require JavaScript closures which are not representable as data.",
    );
  }

  // Check for custom refinements with functions
  if (def.checks && Array.isArray(def.checks)) {
    for (const check of def.checks) {
      if (typeof check.check === "function") {
        throw new Error(
          "fromZod: Zod refinements with custom functions (.refine, .superRefine) cannot be converted to AST. " +
            "These require JavaScript closures which are not representable as data.",
        );
      }
    }
  }

  // Route to type-specific converter
  switch (def.type) {
    case "string":
      return convertString(def, schema, ctx);
    case "number":
      return convertNumber(def, schema, ctx);
    case "bigint":
      return convertBigInt(def, schema, ctx);
    case "boolean":
      return convertBoolean(ctx);
    case "date":
      return convertDate(def, schema, ctx);
    case "literal":
      return convertLiteral(def, ctx);
    case "enum":
      return convertEnum(def, ctx);
    case "object":
      return convertObject(def, ctx);
    case "array":
      return convertArray(def, schema, ctx);
    case "tuple":
      return convertTuple(def, ctx);
    case "record":
      return convertRecord(def, ctx);
    case "union":
      return convertUnion(def, ctx);
    case "optional":
      return convertOptional(def, ctx);
    case "nullable":
      return convertNullable(def, ctx);
    case "default":
      return convertDefault(def, ctx);
    case "any":
    case "unknown":
    case "never":
    case "void":
    case "undefined":
    case "null":
    case "nan":
      return convertPrimitive(def.type, ctx);
    default:
      throw new Error(
        `fromZod: Unsupported Zod type '${def.type}'. ` +
          "This may be a new Zod feature or require a blocking issue (#113, #117, #119) to be implemented first.",
      );
  }
}

function convertString(def: any, schema: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractStringChecks(schema);
  const extra: Record<string, unknown> = def.coerce ? { coerce: true } : {};
  return new ZodStringBuilder(ctx, checks, [], undefined, extra) as unknown as ZodSchemaBuilder<any>;
}

function convertNumber(def: any, schema: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractNumberChecks(schema);
  const extra: Record<string, unknown> = def.coerce ? { coerce: true } : {};
  return new ZodNumberBuilder(ctx, checks, [], undefined, extra) as unknown as ZodSchemaBuilder<any>;
}

function convertBigInt(def: any, schema: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractBigIntChecks(schema);
  return new ZodBigIntBuilder(ctx, checks, [], undefined, {}) as unknown as ZodSchemaBuilder<any>;
}

function convertBoolean(ctx: PluginContext): ZodSchemaBuilder<any> {
  return new ZodPrimitiveBuilder<any>(ctx, "zod/boolean", [], [], undefined, {});
}

function convertDate(def: any, schema: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractDateChecks(schema);
  return new ZodDateBuilder(ctx, checks, [], undefined, {});
}

function convertLiteral(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const value = def.values && def.values[0];
  return new ZodLiteralBuilder<any>(ctx, [], [], undefined, { value });
}

function convertEnum(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const values = def.entries ? Object.values(def.entries) : [];
  return new ZodEnumBuilder<any>(ctx, [], [], undefined, { values });
}

function convertObject(def: any, ctx: PluginContext): ZodObjectBuilder<any> {
  const shape: Record<string, any> = {};

  if (def.shape && typeof def.shape === "object") {
    for (const [key, value] of Object.entries(def.shape)) {
      const builder = fromZod(value as z.ZodType, ctx);
      shape[key] = builder.__schemaNode;
    }
  }

  return new ZodObjectBuilder(ctx, [], [], undefined, { shape });
}

function convertArray(def: any, schema: any, ctx: PluginContext): ZodArrayBuilder<any> {
  const element = fromZod(def.element, ctx).__schemaNode;
  const checks: CheckDescriptor[] = extractArrayChecks(schema);
  return new ZodArrayBuilder(ctx, checks, [], undefined, { element });
}

function convertTuple(def: any, ctx: PluginContext): ZodTupleBuilder<any> {
  const items = def.items
    ? def.items.map((item: z.ZodType) => fromZod(item, ctx).__schemaNode)
    : [];

  const extra: Record<string, unknown> = { items };

  if (def.rest) {
    extra.rest = fromZod(def.rest, ctx).__schemaNode;
  }

  return new ZodTupleBuilder(ctx, [], [], undefined, extra);
}

function convertRecord(def: any, ctx: PluginContext): ZodRecordBuilder<any, any> {
  const keyType = fromZod(def.keyType, ctx).__schemaNode;
  const valueType = fromZod(def.valueType, ctx).__schemaNode;
  return new ZodRecordBuilder(ctx, [], [], undefined, { keyType, valueType });
}

function convertUnion(def: any, ctx: PluginContext): ZodUnionBuilder<any> {
  const options = def.options
    ? def.options.map((opt: z.ZodType) => fromZod(opt, ctx).__schemaNode)
    : [];
  return new ZodUnionBuilder(ctx, "zod/union", [], [], undefined, { options });
}

function convertOptional(def: any, ctx: PluginContext): ZodWrappedBuilder<any> {
  const inner = fromZod(def.innerType, ctx).__schemaNode;
  const wrapperNode: any = { kind: "zod/optional", inner };
  return new ZodWrappedBuilder(ctx, wrapperNode);
}

function convertNullable(def: any, ctx: PluginContext): ZodWrappedBuilder<any> {
  const inner = fromZod(def.innerType, ctx).__schemaNode;
  const wrapperNode: any = { kind: "zod/nullable", inner };
  return new ZodWrappedBuilder(ctx, wrapperNode);
}

function convertDefault(def: any, ctx: PluginContext): ZodWrappedBuilder<any> {
  const inner = fromZod(def.innerType, ctx).__schemaNode;
  const value = ctx.lift(def.defaultValue).__node;
  const wrapperNode: any = { kind: "zod/default", inner, value };
  return new ZodWrappedBuilder(ctx, wrapperNode);
}

function convertPrimitive(type: string, ctx: PluginContext): ZodSchemaBuilder<any> {
  const kind = `zod/${type}`;
  return new ZodPrimitiveBuilder<any>(ctx, kind, [], [], undefined, {});
}

/**
 * Extracts check descriptors from a Zod string schema.
 * Maps Zod's property-based checks to our CheckDescriptor format.
 */
function extractStringChecks(schema: any): CheckDescriptor[] {
  const checks: CheckDescriptor[] = [];

  // Length checks
  if (schema.minLength !== null && schema.minLength !== undefined) {
    checks.push({ kind: "min_length", value: schema.minLength });
  }
  if (schema.maxLength !== null && schema.maxLength !== undefined) {
    checks.push({ kind: "max_length", value: schema.maxLength });
  }

  // Format/pattern checks
  if (schema.format) {
    checks.push({ kind: "string_format", format: schema.format });
  }
  if (schema.regex) {
    checks.push({
      kind: "regex",
      pattern: schema.regex.source || schema.regex.pattern,
      flags: schema.regex.flags,
    });
  }

  return checks;
}

/**
 * Extracts check descriptors from a Zod number schema.
 */
function extractNumberChecks(schema: any): CheckDescriptor[] {
  const checks: CheckDescriptor[] = [];

  if (schema.minValue !== null && schema.minValue !== undefined) {
    checks.push({ kind: "gte", value: schema.minValue });
  }
  if (schema.maxValue !== null && schema.maxValue !== undefined) {
    checks.push({ kind: "lte", value: schema.maxValue });
  }
  if (schema.isInt) {
    checks.push({ kind: "int" });
  }
  if (schema.isFinite === false) {
    // Only add if explicitly set to false
    checks.push({ kind: "finite" });
  }

  return checks;
}

/**
 * Extracts check descriptors from a Zod bigint schema.
 */
function extractBigIntChecks(schema: any): CheckDescriptor[] {
  const checks: CheckDescriptor[] = [];

  if (schema.minValue !== null && schema.minValue !== undefined) {
    checks.push({ kind: "gte", value: schema.minValue.toString() });
  }
  if (schema.maxValue !== null && schema.maxValue !== undefined) {
    checks.push({ kind: "lte", value: schema.maxValue.toString() });
  }

  return checks;
}

/**
 * Extracts check descriptors from a Zod date schema.
 */
function extractDateChecks(schema: any): CheckDescriptor[] {
  const checks: CheckDescriptor[] = [];

  if (schema.minValue !== null && schema.minValue !== undefined) {
    const value = schema.minValue instanceof Date ? schema.minValue.toISOString() : schema.minValue;
    checks.push({ kind: "gte", value });
  }
  if (schema.maxValue !== null && schema.maxValue !== undefined) {
    const value = schema.maxValue instanceof Date ? schema.maxValue.toISOString() : schema.maxValue;
    checks.push({ kind: "lte", value });
  }

  return checks;
}

/**
 * Extracts check descriptors from a Zod array schema.
 */
function extractArrayChecks(schema: any): CheckDescriptor[] {
  const checks: CheckDescriptor[] = [];

  if (schema.minLength !== null && schema.minLength !== undefined) {
    checks.push({ kind: "min_length", value: schema.minLength });
  }
  if (schema.maxLength !== null && schema.maxLength !== undefined) {
    checks.push({ kind: "max_length", value: schema.maxLength });
  }

  return checks;
}
