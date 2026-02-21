import { makeNExpr, type NExpr, type NodeEntry, type RuntimeEntry } from "./expr";
import type { PredBase, SelectKeys } from "./predicates";

type SpliceList<C extends string[], Adj, Matched extends string> = C extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends Matched
    ? H extends keyof Adj
      ? Adj[H] extends NodeEntry<string, infer HC extends string[], unknown>
        ? [...SpliceList<HC, Adj, Matched>, ...SpliceList<T, Adj, Matched>]
        : SpliceList<T, Adj, Matched>
      : SpliceList<T, Adj, Matched>
    : [H, ...SpliceList<T, Adj, Matched>]
  : [];

/** Adjacency after removing matched nodes and reconnecting surviving children. */
export type SpliceAdj<Adj, Matched extends string> = {
  [K in keyof Adj as K extends Matched ? never : K]: Adj[K] extends NodeEntry<
    infer Kind extends string,
    infer Ch extends string[],
    infer O
  >
    ? NodeEntry<Kind, SpliceList<Ch, Adj, Matched>, O>
    : Adj[K];
};

type SpliceRoot<R extends string, Adj, Matched extends string> = R extends Matched
  ? R extends keyof Adj
    ? Adj[R] extends NodeEntry<string, [infer First extends string, ...string[]], unknown>
      ? First
      : R
    : R
  : R;

function rSplice(
  children: string[],
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
): string[] {
  const result: string[] = [];
  for (const child of children) {
    if (!matched.has(child)) {
      result.push(child);
      continue;
    }
    const entry = adj[child];
    if (entry) result.push(...rSplice(entry.children, adj, matched));
  }
  return result;
}

function resolveRef(id: string, adj: Record<string, RuntimeEntry>, matched: Set<string>): string {
  if (!matched.has(id)) return id;
  const entry = adj[id];
  if (!entry) return id;
  for (const child of entry.children) {
    const resolved = resolveRef(child, adj, matched);
    if (resolved) return resolved;
  }
  return id;
}

function rewriteOutRefs(
  value: unknown,
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
): unknown {
  if (typeof value === "string") return value in adj ? resolveRef(value, adj, matched) : value;
  if (Array.isArray(value)) return value.map((item) => rewriteOutRefs(item, adj, matched));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteOutRefs(v, adj, matched);
    return out;
  }
  return value;
}

/** Remove matching nodes and splice through their children recursively. */
export function spliceWhere<O, R extends string, Adj, C extends string, P extends PredBase>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
): NExpr<O, SpliceRoot<R, Adj, SelectKeys<Adj, P>>, SpliceAdj<Adj, SelectKeys<Adj, P>>, C> {
  const matched = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) matched.add(id);
  }
  const nextAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (matched.has(id)) continue;
    nextAdj[id] = {
      ...entry,
      children: rSplice(entry.children, expr.__adj, matched),
      out:
        entry.kind === "core/record" || entry.kind === "core/tuple"
          ? rewriteOutRefs(entry.out, expr.__adj, matched)
          : entry.out,
    };
  }
  let nextRoot = expr.__id;
  if (matched.has(nextRoot)) {
    const rootEntry = expr.__adj[nextRoot];
    if (rootEntry?.children.length) nextRoot = rootEntry.children[0];
  }
  return makeNExpr(
    nextRoot as SpliceRoot<R, Adj, SelectKeys<Adj, P>>,
    nextAdj,
    expr.__counter as C,
  ) as NExpr<O, SpliceRoot<R, Adj, SelectKeys<Adj, P>>, SpliceAdj<Adj, SelectKeys<Adj, P>>, C>;
}
