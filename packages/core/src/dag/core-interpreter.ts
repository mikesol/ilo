/**
 * Core interpreter — handles core/* node kinds in fold().
 *
 * Provides handlers for fundamental node kinds that are not
 * plugin-specific: literals, conditionals, sequencing.
 */

import type { Interpreter } from "./fold";

/**
 * Create the core interpreter for core/* node kinds.
 *
 * Handles:
 * - `core/literal`: returns the node's `out` value
 * - `core/cond`: evaluates predicate, then evaluates then/else branch
 * - `core/discard`: evaluates side-effect child, returns result child
 */
export function createCoreDagInterpreter(): Interpreter {
  return {
    "core/literal": async function* (entry) {
      return entry.out;
    },
    "core/cond": async function* () {
      const pred = (yield 0) as boolean;
      return pred ? yield 1 : yield 2;
    },
    "core/discard": async function* () {
      yield 0; // side effect
      return yield 1; // return value
    },
  };
}
