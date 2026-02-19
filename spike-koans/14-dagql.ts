/**
 * Koan 14: DagQL — fluent chaining API
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - dagql(expr) returns a DagQL wrapper
 * - .replaceWhere(pred, kind) chains with updated types
 * - .spliceWhere(pred) chains with updated types
 * - .mapWhere(pred, fn) chains with updated types
 * - .result() returns the final NExpr
 * - Chained: replace add→sub, then splice literals, verify result
 * - Identity: dagql(expr).result() preserves types
 * - wrapByName intentionally excluded (takes ID, not predicate)
 *
 * Design decision:
 * - DagQL's Adj uses Record<string, any> constraint (not NodeEntry)
 *   to avoid catch-all intersections that poison keyof for SpliceAdj.
 * - result() adds & Record<string, NodeEntry<...>> to satisfy NExpr's
 *   constraint. For precise type extraction (e.g., testing removed keys),
 *   use DagQLAdj<D> which extracts Adj directly from DagQL without
 *   the catch-all.
 *
 * Imports: 13-named (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/14-dagql.ts
 *   npx tsx spike-koans/14-dagql.ts
 */

export * from "./13-named";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  PredBase,
  SelectKeys,
  MatchingEntries,
  MapAdj,
  MapOut,
  SpliceAdj,
} from "./13-named";
import {
  numLit,
  add,
  mul,
  app,
  byKind,
  isLeaf,
  mapWhere as mapWhereFn,
  replaceWhere as replaceWhereFn,
  spliceWhere as spliceWhereFn,
} from "./13-named";

// ─── Local: unexported types from earlier koans ─────────────────────
type ReplaceKind<Entry, NK extends string> =
  Entry extends NodeEntry<any, infer C extends string[], infer O>
    ? NodeEntry<NK, C, O>
    : never;

type SpliceRoot<
  R extends string, Adj, Matched extends string,
> = R extends Matched
  ? R extends keyof Adj
    ? Adj[R] extends NodeEntry<
        any, [infer First extends string, ...string[]], any
      >
      ? First
      : R
    : R
  : R;

// ─── DagQL: fluent chaining wrapper ─────────────────────────────────
// Adj uses Record<string, any> — avoids NodeEntry catch-all that would
// add an index signature and break SpliceAdj's key filtering.
export class DagQL<
  O,
  R extends string,
  Adj extends Record<string, any>,
  C extends string,
> {
  readonly _expr: NExpr<any, any, any, any>;

  constructor(expr: NExpr<any, any, any, any>) {
    this._expr = expr;
  }

  mapWhere<P extends PredBase, NE extends NodeEntry<string, string[], any>>(
    pred: P,
    fn: (entry: MatchingEntries<Adj, P>) => NE,
  ): DagQL<MapOut<O, Adj, R, P, NE>, R, MapAdj<Adj, P, NE>, C> {
    return new DagQL(mapWhereFn(this._expr as any, pred, fn as any)) as any;
  }

  replaceWhere<P extends PredBase, NK extends string>(
    pred: P,
    newKind: NK,
  ): DagQL<
    MapOut<O, Adj, R, P, ReplaceKind<MatchingEntries<Adj, P>, NK>>,
    R,
    MapAdj<Adj, P, ReplaceKind<MatchingEntries<Adj, P>, NK>>,
    C
  > {
    return new DagQL(
      replaceWhereFn(this._expr as any, pred, newKind),
    ) as any;
  }

  spliceWhere<P extends PredBase>(pred: P): DagQL<
    O,
    SpliceRoot<R, Adj, SelectKeys<Adj, P>>,
    SpliceAdj<Adj, SelectKeys<Adj, P>>,
    C
  > {
    return new DagQL(spliceWhereFn(this._expr as any, pred)) as any;
  }

  result(): NExpr<
    O, R,
    Adj & Record<string, NodeEntry<string, string[], any>>,
    C
  > {
    return this._expr as any;
  }
}

// ─── DagQLAdj: precise type extraction without catch-all ────────────
// Use this instead of AdjOf(result()) when you need to test removed keys.
export type DagQLAdj<D> =
  D extends DagQL<any, any, infer A, any> ? A : never;

export function dagql<
  O,
  R extends string,
  Adj extends Record<string, NodeEntry<string, string[], any>>,
  C extends string,
>(expr: NExpr<O, R, Adj, C>): DagQL<O, R, Adj, C> {
  return new DagQL(expr);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// (3+4)*5: a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Identity: dagql(expr).result() preserves types ---
const identity = dagql(prog).result();
type IAdj = AdjOf<typeof identity>;
const _iC: IAdj["c"]["kind"] = "num/add";
const _iE: IAdj["e"]["kind"] = "num/mul";
const _iA: IAdj["a"]["kind"] = "num/literal";

// --- Single replaceWhere ---
const justReplace = dagql(prog)
  .replaceWhere(byKind("num/add"), "num/sub")
  .result();
type JRAdj = AdjOf<typeof justReplace>;
const _jrC: JRAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _jrCBad: JRAdj["c"]["kind"] = "num/add";
const _jrA: JRAdj["a"]["kind"] = "num/literal"; // preserved

// --- Chained: replace add→sub, then splice literals ---
// Use DagQL wrapper for precise type tests (no catch-all)
const chainedDQ = dagql(prog)
  .replaceWhere(byKind("num/add"), "num/sub")
  .spliceWhere(isLeaf());
type ChAdj = DagQLAdj<typeof chainedDQ>;

// c is now "num/sub" with empty children (leaves spliced)
const _chC: ChAdj["c"]["kind"] = "num/sub";
const _chCCh: ChAdj["c"]["children"] = [];

// e is "num/mul" with children ["c"] (d was a leaf, spliced)
const _chE: ChAdj["e"]["kind"] = "num/mul";
const _chECh: ChAdj["e"]["children"] = ["c"];

// Literals removed (precise via DagQLAdj — no catch-all)
// @ts-expect-error — "a" was spliced
type _chA = ChAdj["a"]["kind"];
// @ts-expect-error — "d" was spliced
type _chD = ChAdj["d"]["kind"];

// result() still usable for runtime access
const chained = chainedDQ.result();
type ChId = IdOf<typeof chained>;
const _chId: ChId = "e";

// --- Single spliceWhere (via DagQLAdj for precision) ---
const spliceDQ = dagql(prog).spliceWhere(isLeaf());
type JSAdj = DagQLAdj<typeof spliceDQ>;
const _jsC: JSAdj["c"]["kind"] = "num/add";
const _jsCCh: JSAdj["c"]["children"] = [];
const _jsECh: JSAdj["e"]["children"] = ["c"];
// @ts-expect-error — "a" was spliced
type _jsA = JSAdj["a"]["kind"];

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Identity
assert(identity.__adj["c"].kind === "num/add", "identity c kind");
assert(identity.__id === "e", "identity root");

// Single replace
assert(justReplace.__adj["c"].kind === "num/sub", "replace c is num/sub");
assert(justReplace.__adj["a"].kind === "num/literal", "replace a preserved");

// Chained: replace + splice
assert(chained.__adj["c"].kind === "num/sub", "chain c is num/sub");
assert(
  JSON.stringify(chained.__adj["c"].children) === "[]",
  "chain c children empty",
);
assert(chained.__adj["e"].kind === "num/mul", "chain e is num/mul");
assert(
  JSON.stringify(chained.__adj["e"].children) === '["c"]',
  "chain e children = [c]",
);
assert(!("a" in chained.__adj), "chain a spliced");
assert(!("d" in chained.__adj), "chain d spliced");
assert(chained.__id === "e", "chain root unchanged");
assert(Object.keys(chained.__adj).length === 2, "chain 2 nodes survive");

// Single splice
const justSplice = spliceDQ.result();
assert(
  JSON.stringify(justSplice.__adj["c"].children) === "[]",
  "splice c children empty",
);
assert(
  JSON.stringify(justSplice.__adj["e"].children) === '["c"]',
  "splice e children = [c]",
);

console.log(`\n14-dagql: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
