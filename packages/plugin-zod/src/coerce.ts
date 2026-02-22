import { ZodNumberBuilder } from "./number";
import { ZodStringBuilder } from "./string";

export interface ZodCoerceNamespace {
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
}

export const coerceNodeKinds: string[] = [];

export function coerceNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): { coerce: ZodCoerceNamespace } {
  return {
    coerce: {
      string: (e) => new ZodStringBuilder([], [], parseError(e), { coerce: true }),
      number: (e) => new ZodNumberBuilder([], [], parseError(e), { coerce: true }),
    },
  };
}
