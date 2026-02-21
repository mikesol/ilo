import { describe, test, expect } from "vitest";
import {
  numLit, add, mul, sub, app, fold, defaults, stdPlugins,
  replaceWhere, byKind, pipe, selectWhere,
  mvfm, numPlugin, strPlugin, boolPlugin,
  numPluginU, strPluginU, boolPluginU,
  type RuntimeEntry, type NExpr, type Interpreter, type Handler, type PluginDef,
} from "../../src/__koans__/16-bridge";

// ── helpers ──────────────────────────────────────────────────────────
const numInterp = defaults([
  { name: "num", nodeKinds: ["num/literal","num/add","num/mul","num/sub"],
    defaultInterpreter: () => ({
      "num/literal": async function* (e) { return e.out as number; },
      "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
      "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
      "num/sub": async function* () { return ((yield 0) as number) - ((yield 1) as number); },
    }),
  },
]);

const boolDef: PluginDef = {
  name: "bool", nodeKinds: ["bool/literal"],
  defaultInterpreter: () => ({
    "bool/literal": async function* (e) { return e.out as boolean; },
  }),
};
const coreDef: PluginDef = {
  name: "core", nodeKinds: ["core/cond"],
  defaultInterpreter: () => ({
    "core/cond": async function* () {
      const p = (yield 0) as boolean;
      return p ? yield 1 : yield 2;
    },
  }),
};
const condInterp = defaults([coreDef, boolDef, {
  name: "num", nodeKinds: ["num/literal"],
  defaultInterpreter: () => ({
    "num/literal": async function* (e) { return e.out as number; },
  }),
}]);

// ── Basic fold ───────────────────────────────────────────────────────
describe("basic fold", () => {
  test("(3+4)*5 = 35", async () => {
    const p = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    expect(await fold(p, numInterp)).toBe(35);
  });
  test("single literal", async () => {
    const p = app(numLit(42));
    expect(await fold(p, numInterp)).toBe(42);
  });
  test("sub(10,3) = 7", async () => {
    const p = app(sub(numLit(10), numLit(3)));
    expect(await fold(p, numInterp)).toBe(7);
  });
  test("nested 4 levels", async () => {
    // add(mul(sub(10,3), add(1,2)), numLit(5))
    const p = app(add(mul(sub(numLit(10), numLit(3)), add(numLit(1), numLit(2))), numLit(5)));
    // (10-3)*(1+2)+5 = 7*3+5 = 26
    expect(await fold(p, numInterp)).toBe(26);
  });
  test("mul(2,3) = 6", async () => {
    expect(await fold(app(mul(numLit(2), numLit(3))), numInterp)).toBe(6);
  });
  test("sub(0,5) = -5", async () => {
    expect(await fold(app(sub(numLit(0), numLit(5))), numInterp)).toBe(-5);
  });
  test("add(0,0) = 0", async () => {
    expect(await fold(app(add(numLit(0), numLit(0))), numInterp)).toBe(0);
  });
  test("mul(add(1,1),sub(5,3)) = 4", async () => {
    const p = app(mul(add(numLit(1), numLit(1)), sub(numLit(5), numLit(3))));
    expect(await fold(p, numInterp)).toBe(4);
  });
});

// ── Memoization ──────────────────────────────────────────────────────
describe("memoization", () => {
  test("shared node evaluated once", async () => {
    let evals = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) { evals++; return e.out as number; },
      "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    expect(await fold<number>("b", adj, ci)).toBe(10);
    expect(evals).toBe(1);
  });
  test("diamond: A used by B and C, both by D", async () => {
    let aEvals = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) { aEvals++; return e.out as number; },
      "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
      c: { kind: "num/add", children: ["a", "a"], out: undefined },
      d: { kind: "num/add", children: ["b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, ci)).toBe(4);
    expect(aEvals).toBe(1);
  });
  test("multiple shared leaves each once", async () => {
    let evals = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) { evals++; return e.out as number; },
      "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    };
    const adj: Record<string, RuntimeEntry> = {
      x: { kind: "num/literal", children: [], out: 2 },
      y: { kind: "num/literal", children: [], out: 3 },
      p: { kind: "num/add", children: ["x", "y"], out: undefined },
      q: { kind: "num/add", children: ["x", "y"], out: undefined },
      r: { kind: "num/add", children: ["p", "q"], out: undefined },
    };
    expect(await fold<number>("r", adj, ci)).toBe(10);
    expect(evals).toBe(2); // x once, y once
  });
  test("handler runs exactly once per node", async () => {
    let addRuns = 0;
    const oi: Interpreter = {
      "num/literal": async function* (e) { return e.out as number; },
      "num/add": async function* () { addRuns++; return ((yield 0) as number) + ((yield 1) as number); },
      "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
    };
    const p = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    expect(await fold(p, oi)).toBe(35);
    expect(addRuns).toBe(1);
  });
  test("shared add node evaluated once", async () => {
    let addRuns = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) { return e.out as number; },
      "num/add": async function* () { addRuns++; return ((yield 0) as number) + ((yield 1) as number); },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      s: { kind: "num/add", children: ["a", "b"], out: undefined },
      t: { kind: "num/add", children: ["s", "s"], out: undefined },
    };
    expect(await fold<number>("t", adj, ci)).toBe(6);
    expect(addRuns).toBe(2); // s once, t once
  });
});

// ── Short-circuit ────────────────────────────────────────────────────
describe("short-circuit", () => {
  test("cond(true) evaluates only then-branch", async () => {
    let branchEvals = 0;
    const ti: Interpreter = {
      "bool/literal": async function* (e) { return e.out; },
      "num/literal": async function* (e) { branchEvals++; return e.out; },
      "core/cond": async function* () { const p = yield 0; return p ? yield 1 : yield 2; },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "num/literal", children: [], out: 10 },
      c: { kind: "num/literal", children: [], out: 20 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, ti)).toBe(10);
    expect(branchEvals).toBe(1);
  });
  test("cond(false) evaluates only else-branch", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      b: { kind: "num/literal", children: [], out: 10 },
      c: { kind: "num/literal", children: [], out: 20 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, condInterp)).toBe(20);
  });
  test("only 1 branch literal evaluated", async () => {
    let evals = 0;
    const ti: Interpreter = {
      "bool/literal": async function* (e) { return e.out; },
      "num/literal": async function* (e) { evals++; return e.out; },
      "core/cond": async function* () { return (yield 0) ? yield 1 : yield 2; },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      b: { kind: "num/literal", children: [], out: 1 },
      c: { kind: "num/literal", children: [], out: 2 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    await fold<number>("d", adj, ti);
    expect(evals).toBe(1);
  });
});

// ── Handler protocol ─────────────────────────────────────────────────
describe("handler protocol", () => {
  test("yield number returns child at index", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
    };
    expect(await fold<number>("c", adj, numInterp)).toBe(10);
  });
  test("yield string returns node by ID", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 99 },
      b: { kind: "geom/wrap", children: [], out: { ref: "a" } },
    };
    const si: Interpreter = {
      ...numInterp,
      "geom/wrap": async function* (e) { return yield (e.out as any).ref; },
    };
    expect(await fold<number>("b", adj, si)).toBe(99);
  });
  test("missing handler throws", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "unknown/kind", children: [], out: 1 },
    };
    await expect(fold<number>("a", adj, numInterp)).rejects.toThrow("no handler");
  });
  test("missing node throws", async () => {
    await expect(fold<number>("nope", {}, numInterp)).rejects.toThrow("missing node");
  });
  test("out-of-range child index throws", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/add", children: ["a"], out: undefined }, // only 1 child but add yields 0,1
    };
    await expect(fold<number>("b", adj, numInterp)).rejects.toThrow();
  });
});

// ── NExpr overload ───────────────────────────────────────────────────
describe("NExpr overload", () => {
  test("fold(expr, interp) infers number", async () => {
    const p = app(add(numLit(1), numLit(2)));
    const r = await fold(p, numInterp);
    expect(r).toBe(3);
  });
  test("fold(expr, interp) works without manual <T>", async () => {
    const p = app(mul(numLit(6), numLit(7)));
    const r: number = await fold(p, numInterp);
    expect(r).toBe(42);
  });
  test("3-arg form still works", async () => {
    const p = app(numLit(99));
    expect(await fold<number>(p.__id, p.__adj, numInterp)).toBe(99);
  });
});

// ── defaults() ───────────────────────────────────────────────────────
describe("defaults()", () => {
  test("defaults(stdPlugins) works", async () => {
    const interp = defaults(stdPlugins);
    const p = app(add(numLit(2), numLit(3)));
    expect(await fold(p, interp)).toBe(5);
  });
  test("override replaces plugin", async () => {
    const interp = defaults(stdPlugins, {
      num: {
        "num/literal": async function* (e) { return (e.out as number) * 100; },
        "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
        "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
        "num/sub": async function* () { return ((yield 0) as number) - ((yield 1) as number); },
      },
    });
    const p = app(add(numLit(1), numLit(2)));
    expect(await fold(p, interp)).toBe(300);
  });
  test("throws on plugin without defaultInterpreter and no override", () => {
    const noInterp: PluginDef = { name: "x", nodeKinds: ["x/foo"] };
    expect(() => defaults([noInterp])).toThrow("no defaultInterpreter");
  });
  test("empty plugin is harmless", () => {
    const empty: PluginDef = { name: "e", nodeKinds: [] };
    const interp = defaults([empty]);
    expect(interp).toEqual({});
  });
  test("override with custom handlers works", async () => {
    const custom: PluginDef = { name: "c", nodeKinds: ["c/dbl"] };
    const interp = defaults([
      { name: "num", nodeKinds: ["num/literal"],
        defaultInterpreter: () => ({ "num/literal": async function* (e) { return e.out as number; } }) },
      custom,
    ], {
      c: { "c/dbl": async function* () { return ((yield 0) as number) * 2; } },
    });
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 4 },
      b: { kind: "c/dbl", children: ["a"], out: undefined },
    };
    expect(await fold<number>("b", adj, interp)).toBe(8);
  });
});

// ── Stack safety ─────────────────────────────────────────────────────
describe("stack safety", () => {
  test("10k-deep chain doesn't overflow", async () => {
    const D = 10_000;
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    for (let i = 1; i < D; i++) {
      adj[`n${i}`] = { kind: "num/add", children: [`n${i-1}`, `n${i-1}`], out: undefined };
    }
    const r = await fold<number>(`n${D-1}`, adj, numInterp);
    expect(typeof r).toBe("number");
  });
  test("result is a valid number", async () => {
    const adj: Record<string, RuntimeEntry> = {
      n0: { kind: "num/literal", children: [], out: 1 },
      n1: { kind: "num/add", children: ["n0", "n0"], out: undefined },
      n2: { kind: "num/add", children: ["n1", "n1"], out: undefined },
    };
    expect(await fold<number>("n2", adj, numInterp)).toBe(4);
  });
});

// ── Full pipeline ────────────────────────────────────────────────────
describe("full pipeline", () => {
  const eqInterp: Interpreter = {
    "num/eq": async function* () { return ((yield 0) as number) === ((yield 1) as number); },
    "str/eq": async function* () { return ((yield 0) as string) === ((yield 1) as string); },
    "bool/eq": async function* () { return ((yield 0) as boolean) === ((yield 1) as boolean); },
  };
  const fpEq: PluginDef = { name: "eq", nodeKinds: ["num/eq","str/eq","bool/eq"], defaultInterpreter: () => eqInterp };
  const fullInterp = defaults([...stdPlugins, fpEq]);
  const $ = mvfm(numPlugin, strPlugin, boolPlugin);

  test("mvfm -> $ -> app -> fold", async () => {
    const p = app($.mul($.add(3, 4), 5));
    expect(await fold(p, fullInterp)).toBe(35);
  });
  test("mvfm -> app -> pipe(replaceWhere) -> fold", async () => {
    const p = app($.mul($.add(3, 4), 5));
    const rw = pipe(p, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(rw, fullInterp)).toBe(-5);
  });
  test("eq(3,3) -> num/eq -> fold -> true", async () => {
    const p = app($.eq(3, 3));
    expect(await fold(p, fullInterp)).toBe(true);
  });
  test("eq('a','b') -> str/eq -> fold -> false", async () => {
    const p = app($.eq("a", "b"));
    expect(await fold(p, fullInterp)).toBe(false);
  });
  test("nested eq(eq(3,3),eq(5,5)) -> true", async () => {
    const p = app($.eq($.eq(3, 3), $.eq(5, 5)));
    expect(await fold(p, fullInterp)).toBe(true);
  });
});

// ── Structural fold ─────────────────────────────────────────────────
describe("structural fold", () => {
  const structInterp: Interpreter = {
    ...numInterp,
    "geom/point": async function* (entry) {
      const m = entry.out as Record<string, string>;
      const x = (yield m.x) as number;
      const y = (yield m.y) as number;
      return { x, y };
    },
  };
  test("handler yields string ID for named children", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "geom/point", children: [], out: { x: "a", y: "a" } },
    };
    const r = await fold<{ x: number; y: number }>("b", adj, structInterp);
    expect(r).toEqual({ x: 10, y: 10 });
  });
  test("geom/point with {x: add, y: literal}", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      c: { kind: "num/literal", children: [], out: 3 },
      d: { kind: "num/add", children: ["a", "b"], out: undefined },
      e: { kind: "geom/point", children: [], out: { x: "d", y: "c" } },
    };
    const r = await fold<{ x: number; y: number }>("e", adj, structInterp);
    expect(r.x).toBe(3);
    expect(r.y).toBe(3);
  });
  test("result has correct x and y values", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 11 },
      c: { kind: "geom/point", children: [], out: { x: "a", y: "b" } },
    };
    const r = await fold<{ x: number; y: number }>("c", adj, structInterp);
    expect(r).toEqual({ x: 7, y: 11 });
  });
});
