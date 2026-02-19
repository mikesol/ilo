/**
 * DAG-model interpreter for fiber/* node kinds.
 *
 * Child layout:
 * - fiber/par: children[0..N-1] = parallel branches
 * - fiber/race: children[0..N-1] = race branches
 * - fiber/seq: children[0..N-1] = sequential steps (returns last)
 *
 * The parallel interpreter uses foldFrom() to spawn independent
 * trampolines for each parallel branch, sharing the adjacency map.
 */

import type { Interpreter } from "../../dag/fold";
import { foldFrom } from "../../dag/fold";

/** Create the fiber plugin interpreter for fold(). */
export function createFiberDagInterpreter(
  getInterpreter: () => Interpreter,
): Interpreter {
  return {
    "fiber/par": async function* (entry) {
      const interp = getInterpreter();
      const results = await Promise.all(
        entry.children.map((childId) =>
          foldFrom(childId, entry as any, interp),
        ),
      );
      return results;
    },
    "fiber/race": async function* (entry) {
      if (entry.children.length === 0) {
        throw new Error("fiber/race: no branches");
      }
      const interp = getInterpreter();
      return await Promise.race(
        entry.children.map((childId) =>
          foldFrom(childId, entry as any, interp),
        ),
      );
    },
    "fiber/seq": async function* (entry) {
      let last: unknown;
      for (let i = 0; i < entry.children.length; i++) {
        last = yield i;
      }
      return last;
    },
  };
}
