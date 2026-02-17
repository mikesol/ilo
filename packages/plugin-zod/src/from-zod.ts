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
      return convertString(def, ctx);
    case "number":
      return convertNumber(def, ctx);
    case "bigint":
      return convertBigInt(def, ctx);
    case "boolean":
      return convertBoolean(ctx);
    case "date":
      return convertDate(def, ctx);
    case "literal":
      return convertLiteral(def, ctx);
    case "enum":
      return convertEnum(def, ctx);
    case "object":
      return convertObject(def, ctx);
    case "array":
      return convertArray(def, ctx);
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

function convertString(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractChecks(def.checks);
  const extra: Record<string, unknown> = def.coerce ? { coerce: true } : {};
  return new ZodStringBuilder(ctx, checks, [], undefined, extra) as unknown as ZodSchemaBuilder<any>;
}

function convertNumber(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractChecks(def.checks);
  const extra: Record<string, unknown> = def.coerce ? { coerce: true } : {};
  return new ZodNumberBuilder(ctx, checks, [], undefined, extra) as unknown as ZodSchemaBuilder<any>;
}

function convertBigInt(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractChecks(def.checks);
  return new ZodBigIntBuilder(ctx, checks, [], undefined, {}) as unknown as ZodSchemaBuilder<any>;
}

function convertBoolean(ctx: PluginContext): ZodSchemaBuilder<any> {
  return new ZodPrimitiveBuilder<any>(ctx, "zod/boolean", [], [], undefined, {});
}

function convertDate(def: any, ctx: PluginContext): ZodSchemaBuilder<any> {
  const checks: CheckDescriptor[] = extractChecks(def.checks);
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

function convertArray(def: any, ctx: PluginContext): ZodArrayBuilder<any> {
  const element = fromZod(def.element, ctx).__schemaNode;
  const checks: CheckDescriptor[] = extractChecks(def.checks);
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
  return new ZodUnionBuilder(ctx, options, [], [], undefined, {});
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
 * Extracts check descriptors from Zod's internal check array.
 * Maps Zod check objects to our CheckDescriptor format.
 */
function extractChecks(zodChecks: any[]): CheckDescriptor[] {
  if (!zodChecks || !Array.isArray(zodChecks)) return [];

  const checks: CheckDescriptor[] = [];

  for (const check of zodChecks) {
    if (!check || !check.def) continue;

    const checkDef = check.def;
    const converted = convertCheck(checkDef);
    if (converted) {
      checks.push(converted);
    }
  }

  return checks;
}

/**
 * Converts a single Zod check definition to our CheckDescriptor format.
 */
function convertCheck(checkDef: any): CheckDescriptor | null {
  if (!checkDef || !checkDef.check) return null;

  switch (checkDef.check) {
    // String checks
    case "string_format":
      return checkDef.format ? { kind: "string_format", format: checkDef.format } : null;
    case "min_length":
      return { kind: "min_length", value: checkDef.value };
    case "max_length":
      return { kind: "max_length", value: checkDef.value };
    case "length":
      return { kind: "length", value: checkDef.value };
    case "regex":
      return { kind: "regex", pattern: checkDef.pattern, flags: checkDef.flags };
    case "starts_with":
      return { kind: "starts_with", value: checkDef.value };
    case "ends_with":
      return { kind: "ends_with", value: checkDef.value };
    case "includes":
      return { kind: "includes", value: checkDef.value };
    case "trim":
      return { kind: "trim" };
    case "to_lower_case":
      return { kind: "to_lower_case" };
    case "to_upper_case":
      return { kind: "to_upper_case" };

    // Number/BigInt/Date checks
    case "min":
      return {
        kind: checkDef.inclusive ? "gte" : "gt",
        value: checkDef.value instanceof Date ? checkDef.value.toISOString() : 
               typeof checkDef.value === "bigint" ? checkDef.value.toString() : 
               checkDef.value,
      };
    case "max":
      return {
        kind: checkDef.inclusive ? "lte" : "lt",
        value: checkDef.value instanceof Date ? checkDef.value.toISOString() : 
               typeof checkDef.value === "bigint" ? checkDef.value.toString() : 
               checkDef.value,
      };
    case "int":
      return { kind: "int" };
    case "finite":
      return { kind: "finite" };
    case "multipleOf":
      return {
        kind: "multiple_of",
        value: typeof checkDef.value === "bigint" ? checkDef.value.toString() : checkDef.value,
      };

    default:
      // Unknown check type - skip silently
      return null;
  }
}
