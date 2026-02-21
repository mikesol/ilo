import { fold } from "./fold";
import type { Interpreter, PluginDef } from "./fold-types";

export { fold };
export type { Handler, Interpreter, PluginDef, ScopedBinding, ScopedEffect } from "./fold-types";
export { VOLATILE_KINDS } from "./fold-types";

/** Compose default interpreters from plugin defs with optional per-plugin overrides. */
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const out: Interpreter = {};
  for (const plugin of plugins) {
    if (plugin.name in overrides) {
      Object.assign(out, overrides[plugin.name]);
      continue;
    }
    if (plugin.defaultInterpreter) {
      Object.assign(out, plugin.defaultInterpreter());
      continue;
    }
    if (plugin.nodeKinds.length === 0) continue;
    throw new Error(`Plugin "${plugin.name}" has no defaultInterpreter and no override`);
  }
  return out;
}
