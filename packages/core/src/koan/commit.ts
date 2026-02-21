import type { DirtyExpr } from "./dirty";
import { makeNExpr, type NExpr } from "./expr";
import type { LiveAdj } from "./gc";
import { liveAdj } from "./gc";

function collectOutRefs(
  value: unknown,
  adj: Record<string, { children: string[] }>,
  refs: string[],
): void {
  if (typeof value === "string") {
    if (value in adj) refs.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOutRefs(item, adj, refs);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) collectOutRefs(nested, adj, refs);
  }
}

/** Remove unreachable entries from a dirty graph using its current root. */
export function gc<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): DirtyExpr<O, R, LiveAdj<Adj, R>, C> {
  return {
    __id: d.__id,
    __adj: liveAdj(d.__adj, d.__id),
    __counter: d.__counter,
  } as unknown as DirtyExpr<O, R, LiveAdj<Adj, R>, C>;
}

/** Validate dirty graph references and freeze back into an NExpr. */
export function commit<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): NExpr<O, R, Adj, C> {
  const root = d.__id;
  const adj = d.__adj;
  if (!adj[root]) throw new Error(`commit: root "${root}" not in adj`);
  for (const [id, entry] of Object.entries(adj)) {
    const refs = [...entry.children];
    if (entry.kind === "core/record" || entry.kind === "core/tuple") {
      collectOutRefs(entry.out, adj, refs);
    }
    for (const child of refs) {
      if (!adj[child]) throw new Error(`commit: node "${id}" references missing child "${child}"`);
    }
  }
  return makeNExpr(root as R, adj, d.__counter as C) as NExpr<O, R, Adj, C>;
}
