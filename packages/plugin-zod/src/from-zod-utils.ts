type AnySchema = { _def?: Record<string, unknown>; def?: Record<string, unknown> };

export function readSchemaDef(schema: unknown): Record<string, unknown> {
  const def = (schema as AnySchema)?._def ?? (schema as AnySchema)?.def;
  if (!def || typeof def !== "object") {
    throw new Error("zod.from: unable to read schema definition");
  }
  return def;
}

export function warnOrThrow(
  strict: boolean,
  warnings: string[],
  path: string,
  message: string,
): void {
  const text = `${path}: ${message}`;
  if (strict) throw new Error(`zod.from strict mode: ${text}`);
  warnings.push(text);
}
