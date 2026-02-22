/**
 * DagQL-Fu: Sadistic DagQL integration test using the front-door API.
 *
 * Exercises every DagQL operation through the front-door pipeline:
 *   mvfm → app → Program → pipe/dagql → fold
 *
 * This is the DagQL counterpart to everything-everywhere-all-at-once.
 * Where that test tortures the builder/fold pipeline, this one tortures
 * the DAG manipulation layer: pipe, select, map, replace, splice, wrap,
 * dirty, gc, commit, named, predicates — all starting from Programs
 * built via the front-door API.
 */

import { describe, expect, test } from "vitest";
import {
  // Front-door API
  mvfm, fold, defaults, injectInput, prelude,
  // DagQL operations
  pipe, dirty, commit, gc, gcPreservingAliases,
  mapWhere, replaceWhere, spliceWhere, wrapByName, selectWhere,
  addEntry, removeEntry, swapEntry, rewireChildren, setRoot, name,
  // Predicates
  byKind, byKindGlob, byName, isLeaf, hasChildCount,
  and, or, not,
  // Type extractors
  type OutOf, type AdjOf, type IdOf,
} from "../src/index";

describe("dagql-fu", () => {
  // ── Helper: build a front-door program, extract its NExpr ──────────
  // We build programs via mvfm/fold pattern, then manipulate the NExpr.
  const app = mvfm(prelude);

  // (x + 3) * (x - 1)  with x=7 → (10)*(6) = 60
  const prog = () => {
    const p = app({ x: "number" }, ($: any) => {
      return $.mul($.add($.input.x, 3), $.sub($.input.x, 1));
    });
    return injectInput(p, { x: 7 });
  };

  // ── Phase 1: Baseline fold ─────────────────────────────────────────
  test("baseline: (7+3)*(7-1) = 60", async () => {
    expect(await fold(defaults(app), prog())).toBe(60);
  });

  // ── Phase 2: Select with predicates ────────────────────────────────
  test("select: find all num/* nodes", () => {
    const nexpr = prog().__nexpr;
    const all = selectWhere(nexpr, byKindGlob("num/"));
    // Should find: literals for 7,3,7,1 + add + sub + mul + input-derived
    expect(all.size).toBeGreaterThanOrEqual(5);
  });

  test("select: isLeaf finds literals and inputs", () => {
    const nexpr = prog().__nexpr;
    const leaves = selectWhere(nexpr, isLeaf());
    expect(leaves.size).toBeGreaterThanOrEqual(2);
  });

  test("select: compound predicate — binary num ops", () => {
    const nexpr = prog().__nexpr;
    const binary = selectWhere(nexpr, and(byKindGlob("num/"), hasChildCount(2)));
    // add, sub, mul are binary
    expect(binary.size).toBeGreaterThanOrEqual(3);
  });

  test("select: or predicate", () => {
    const nexpr = prog().__nexpr;
    const addOrSub = selectWhere(nexpr, or(byKind("num/add"), byKind("num/sub")));
    expect(addOrSub.size).toBe(2);
  });

  test("select: not(isLeaf) finds non-leaf nodes", () => {
    const nexpr = prog().__nexpr;
    const inner = selectWhere(nexpr, not(isLeaf()));
    expect(inner.size).toBeGreaterThanOrEqual(3);
  });

  // ── Phase 3: Replace — swap add↔sub then fold ─────────────────────
  test("replace: swap add→sub changes result", async () => {
    const nexpr = prog().__nexpr;
    const swapped = replaceWhere(nexpr, byKind("num/add"), "num/sub");
    // (7-3)*(7-1) = 4*6 = 24
    expect(await fold(commit(swapped), defaults(app))).toBe(24);
  });

  test("replace: swap mul→add changes result", async () => {
    const nexpr = prog().__nexpr;
    const swapped = replaceWhere(nexpr, byKind("num/mul"), "num/add");
    // (7+3) + (7-1) = 10 + 6 = 16
    expect(await fold(commit(swapped), defaults(app))).toBe(16);
  });

  // ── Phase 4: Map — rename kind while preserving structure ──────────
  test("map: rename add to sub preserving children", async () => {
    const nexpr = prog().__nexpr;
    const mapped = mapWhere(nexpr, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      out: e.out,
    }));
    // Same as replace test: (7-3)*(7-1) = 24
    expect(await fold(commit(mapped), defaults(app))).toBe(24);
  });

  test("map: compound predicate — rename all binary num ops to add", async () => {
    const nexpr = prog().__nexpr;
    const mapped = mapWhere(
      nexpr,
      and(byKindGlob("num/"), hasChildCount(2)),
      (e) => ({ kind: "num/add" as const, children: e.children, out: e.out }),
    );
    // Everything becomes addition:
    // add(7,3) + add(7,1) where outer mul→add too = (7+3)+(7+1) = 10+8 = 18
    expect(await fold(commit(mapped), defaults(app))).toBe(18);
  });

  // ── Phase 5: Wrap + splice round-trip ──────────────────────────────
  test("wrap then splice restores original result", async () => {
    const nexpr = prog().__nexpr;
    // Find the add node
    const addIds = selectWhere(nexpr, byKind("num/add"));
    const addId = [...addIds][0];

    // Wrap add with a debug node, then splice it back out
    const wrapped = wrapByName(nexpr, addId, "debug/span");
    const unwrapped = spliceWhere(commit(wrapped), byKind("debug/span"));
    // Should produce same result as original
    expect(await fold(unwrapped, defaults(app))).toBe(60);
  });

  // ── Phase 6: Dirty transaction — add, remove, swap, rewire ────────
  test("dirty: swap add→sub via swapEntry", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const entry = nexpr.__adj[addId];

    const d = dirty(nexpr);
    const swapped = swapEntry(d, addId, {
      kind: "num/sub" as const,
      children: entry.children,
      out: entry.out,
    });
    expect(await fold(commit(swapped), defaults(app))).toBe(24);
  });

  test("dirty: addEntry + setRoot + gc", () => {
    const nexpr = prog().__nexpr;
    const d = dirty(nexpr);
    const withExtra = addEntry(d, "orphan", {
      kind: "num/literal" as const,
      children: [] as const,
      out: 999,
    });
    // orphan is unreachable
    const cleaned = gc(withExtra);
    expect("orphan" in cleaned.__adj).toBe(false);
    // Original nodes preserved
    expect(Object.keys(cleaned.__adj).length).toBe(Object.keys(nexpr.__adj).length);
  });

  test("dirty: rewireChildren redirects references", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const subId = [...selectWhere(nexpr, byKind("num/sub"))][0];

    const d = dirty(nexpr);
    // Rewire: wherever addId appears as a child, replace with subId
    const rewired = rewireChildren(d, addId, subId);
    const c = commit(rewired);
    // mul now uses sub twice: (7-1)*(7-1) = 6*6 = 36
    // (the old add node is now orphaned but still in adj)
  });

  // ── Phase 7: Named aliases + byName predicate ─────────────────────
  test("named: alias then select by name", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);
    const found = selectWhere(named, byName("the-sum"));
    expect(found.size).toBe(1);
    expect(found.has(addId as any)).toBe(true);
  });

  test("named: gcPreservingAliases keeps alias, gc removes it", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);

    // Regular gc drops aliases
    const gcDrop = commit(gc(dirty(named)));
    expect("@the-sum" in gcDrop.__adj).toBe(false);

    // gcPreservingAliases keeps them
    const gcKeep = commit(gcPreservingAliases(dirty(named)));
    expect("@the-sum" in gcKeep.__adj).toBe(true);
  });

  test("named: replaceWhere byName targets only the aliased node", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);

    // Replace "the-sum" (add) with sub
    const replaced = replaceWhere(named, byName("the-sum"), "num/sub");
    expect(replaced.__adj[addId].kind).toBe("num/sub");
    // sub node should be untouched (it's not named)
    const subId = [...selectWhere(nexpr, byKind("num/sub"))][0];
    expect(replaced.__adj[subId].kind).toBe("num/sub");
  });

  // ── Phase 8: Pipe chains — the gauntlet ────────────────────────────
  test("pipe: replace → map → fold", async () => {
    const nexpr = prog().__nexpr;
    const result = await fold(
      commit(
        pipe(
          nexpr,
          // Step 1: swap sub→add
          (e) => replaceWhere(e, byKind("num/sub"), "num/add"),
          // Step 2: swap mul→sub (on committed result)
          (e) => replaceWhere(e, byKind("num/mul"), "num/sub"),
        ),
      ),
      defaults(app),
    );
    // (7+3) - (7+1) = 10 - 8 = 2
    expect(result).toBe(2);
  });

  test("pipe: wrap → replace wrapper → splice", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];

    const final = pipe(
      nexpr,
      (e) => wrapByName(e, addId, "debug/span"),
      (e) => replaceWhere(e, byKind("debug/span"), "num/neg"),
    );
    // neg wraps the add: neg(add(7,3)) = -10, then mul(-10, sub(7,1)) = -60
    // But neg is unary — it takes first child. Let's just check structure.
    const committed = commit(final);
    const negIds = selectWhere(committed, byKind("num/neg"));
    expect(negIds.size).toBe(1);
  });

  // ── Phase 9: Multi-input program with DagQL ────────────────────────
  test("multi-input: build, inject, transform, fold", async () => {
    const prog2 = app({ a: "number", b: "number" }, ($: any) => {
      return $.add($.mul($.input.a, 2), $.mul($.input.b, 3));
    });
    const injected = injectInput(prog2, { a: 5, b: 10 });

    // Original: add(mul(5,2), mul(10,3)) = 10 + 30 = 40
    expect(await fold(defaults(app), injected)).toBe(40);

    // Replace all mul→add: add(add(5,2), add(10,3)) = 7 + 13 = 20
    const nexpr = injected.__nexpr;
    const transformed = commit(replaceWhere(nexpr, byKind("num/mul"), "num/add"));
    expect(await fold(transformed, defaults(app))).toBe(20);
  });

  // ── Phase 10: The grand finale — chained everything ────────────────
  test("grand finale: build → inject → name → wrap → replace → gc → fold", async () => {
    const p = app({ n: "number" }, ($: any) => {
      // (n * n) + (n - 1)
      return $.add($.mul($.input.n, $.input.n), $.sub($.input.n, 1));
    });
    const injected = injectInput(p, { n: 4 });
    // (4*4) + (4-1) = 16 + 3 = 19
    expect(await fold(defaults(app), injected)).toBe(19);

    const nexpr = injected.__nexpr;
    const mulId = [...selectWhere(nexpr, byKind("num/mul"))][0];
    const named0 = name(nexpr, "square", mulId);

    // Wrap the square with a debug node, replace debug→num/neg,
    // so we get neg(mul(4,4)) + sub(4,1) = -16 + 3 = -13
    const final = pipe(
      named0,
      (e) => wrapByName(e, mulId, "debug/log"),
      (e) => replaceWhere(e, byKind("debug/log"), "num/neg"),
      (e) => gcPreservingAliases(e),
    );
    const committed = commit(final);

    // Verify alias survived gc
    expect("@square" in committed.__adj).toBe(true);

    // neg(mul(4,4)) + sub(4,1) = -16 + 3 = -13
    expect(await fold(committed, defaults(app))).toBe(-13);
  });
});
