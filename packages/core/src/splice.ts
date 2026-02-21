/**
 * Splice — remove matched nodes and reconnect children.
 *
 * SpliceAdj removes matched entries and reconnects surviving parents
 * to the children of spliced nodes. Handles recursive splice where
 * children of spliced nodes are themselves spliced.
 */

import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import { makeNExpr } from "./expr";
import type { PredBase, SelectKeys } from "./predicates";
import { extractChildIds } from "./structural-children";

/** Recursively replace matched children with their own children. */
type SpliceList<C extends string[], Adj, Matched extends string> = C extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends Matched
    ? H extends keyof Adj
      ? Adj[H] extends NodeEntry<any, infer HC extends string[], any>
        ? [...SpliceList<HC, Adj, Matched>, ...SpliceList<T, Adj, Matched>]
        : SpliceList<T, Adj, Matched>
      : SpliceList<T, Adj, Matched>
    : [H, ...SpliceList<T, Adj, Matched>]
  : [];

/** Remove matched nodes from adj, reconnect surviving children. */
export type SpliceAdj<Adj, Matched extends string> = {
  [K in keyof Adj as K extends Matched ? never : K]: Adj[K] extends NodeEntry<
    infer Kind extends string,
    infer Ch extends string[],
    infer O
  >
    ? NodeEntry<Kind, SpliceList<Ch, Adj, Matched>, O>
    : Adj[K];
};

/** If root is matched, take its first child as new root. */
type SpliceRoot<R extends string, Adj, Matched extends string> = R extends Matched
  ? R extends keyof Adj
    ? Adj[R] extends NodeEntry<any, [infer First extends string, ...string[]], any>
      ? First
      : R
    : R
  : R;

/** Remove all nodes matching the predicate, reconnecting their children to parents. */
export function spliceWhere<O, R extends string, Adj, C extends string, P extends PredBase>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
): NExpr<O, SpliceRoot<R, Adj, SelectKeys<Adj, P>>, SpliceAdj<Adj, SelectKeys<Adj, P>>, C> {
  const matched = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      matched.add(id);
    }
  }

  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (matched.has(id)) continue;
    newAdj[id] = {
      ...entry,
      children: rSplice(entry.children, expr.__adj, matched) as string[],
    };
  }

  let newRoot = expr.__id;
  if (matched.has(newRoot)) {
    const rootEntry = expr.__adj[newRoot];
    const rootChildIds = extractChildIds(rootEntry?.children ?? []);
    if (rootChildIds.length > 0) {
      newRoot = rootChildIds[0];
    }
  }

  return makeNExpr(newRoot, newAdj, expr.__counter) as any;
}

/**
 * Resolve a matched string ID through splice: return flat array of replacement IDs.
 * Recursively resolves if replacement children are also matched.
 */
function resolveSpliceId(
  id: string,
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
): string[] {
  if (!matched.has(id)) return [id];
  const entry = adj[id];
  if (!entry) return [id];
  const childIds = extractChildIds(entry.children);
  const result: string[] = [];
  for (const c of childIds) {
    result.push(...resolveSpliceId(c, adj, matched));
  }
  return result;
}

/** Recursively resolve children through spliced nodes at runtime, handling structural children. */
function rSplice(
  children: unknown,
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
): unknown {
  if (typeof children === "string") {
    const resolved = resolveSpliceId(children, adj, matched);
    // In a scalar position (record value), take the first replacement
    return resolved[0] ?? children;
  }
  if (Array.isArray(children)) {
    const result: unknown[] = [];
    for (const c of children) {
      if (typeof c === "string") {
        // In an array position, splice can expand to multiple IDs
        const resolved = resolveSpliceId(c, adj, matched);
        result.push(...resolved);
      } else {
        result.push(rSplice(c, adj, matched));
      }
    }
    return result;
  }
  if (typeof children === "object" && children !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(children)) {
      result[key] = rSplice(val, adj, matched);
    }
    return result;
  }
  return children;
}
