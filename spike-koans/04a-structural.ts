/**
 * Koan 04a: Structural — CExprs inside records and tuples
 *
 * Proves that app() can walk into complex structures (records, tuples),
 * find CExprs inside, elaborate them, and validate types against the
 * registry. Invalid structures produce `never` at compile time.
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/04a-structural.ts
 *   npx tsx spike-koans/04a-structural.ts
 */

import type {
  CExpr,
  NExpr,
  NodeEntry,
  RuntimeEntry,
  KindSpec,
  Increment,
  NeverGuard,
  LiftKind,
} from "./04-normalize";
import { makeCExpr, makeNExpr, isCExpr, incrementId, add, mul } from "./04-normalize";

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURAL REGISTRY
// ═══════════════════════════════════════════════════════════════════════

type StructuralRegistry = {
  "num/literal": KindSpec<[], number>;
  "num/add": KindSpec<[number, number], number>;
  "num/mul": KindSpec<[number, number], number>;
  "geom/point": KindSpec<[{ x: number; y: number }], { x: number; y: number }>;
  "geom/line": KindSpec<
    [{ start: { x: number; y: number }; end: { x: number; y: number } }],
    { start: { x: number; y: number }; end: { x: number; y: number } }
  >;
  "data/pair": KindSpec<[[number, number]], [number, number]>;
};

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL: DeepResolve + UnionToTuple
// ═══════════════════════════════════════════════════════════════════════

// Replace CExprs with their declared output types (for structural check)
type DeepResolve<T> =
  T extends CExpr<infer O, any, any> ? O
  : T extends readonly [] ? []
  : T extends readonly [infer H, ...infer Rest]
    ? [DeepResolve<H>, ...DeepResolve<Rest>]
  : T extends object ? { [K in keyof T]: DeepResolve<T[K]> }
  : T;

// Convert union to tuple (deterministic key ordering for records)
type _UTI<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I : never;
type _LastOf<U> =
  _UTI<U extends any ? () => U : never> extends () => infer R ? R : never;
type UnionToTuple<U, Last = _LastOf<U>> =
  [U] extends [never] ? [] : [...UnionToTuple<Exclude<U, Last>>, Last];

// Extract record values as tuple (in key order)
type ValuesAsTuple<T, Keys extends readonly any[]> =
  Keys extends readonly [] ? []
  : Keys extends readonly [infer K extends keyof T, ...infer Rest]
    ? [T[K], ...ValuesAsTuple<T, Rest>]
  : [];

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL: ELABORATOR WITH STRUCTURAL SUPPORT
// ═══════════════════════════════════════════════════════════════════════

// Results: [Adj, NextCtr, ThisNodeId, OutputType]

// All results: [Adj, NextCtr, ChildIds[], OutputType]
// ChildIds is always an array — singleton for CExpr/primitive, multiple for structural.

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  // Case 1: CExpr — recurse
  Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ]
          ? O extends Expected ? [A2, C2, [Id], O] : never
          : never
      >
    // Case 2: check if Expected is a liftable primitive
    : [LiftKind<Expected>] extends [never]
      // Expected is NOT a primitive — must be structural
      ? DeepResolve<Arg> extends Expected
        ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
        : never
      // Expected IS a primitive — try to lift
      : Arg extends Expected
        ? [
            Adj & Record<Ctr, NodeEntry<LiftKind<Expected>, [], Expected>>,
            Increment<Ctr>,
            [Ctr],
            Expected,
          ]
        // Arg has CExprs inside — try structural resolve
        : DeepResolve<Arg> extends Expected
          ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
          : never;

// ─── ElaborateStructural: walk a structure, elaborate CExprs inside ──
// Returns [Adj, Ctr, ChildIds[], ResolvedType]
type ElaborateStructural<
  Reg, Value, Expected, Adj, Ctr extends string,
> =
  // CExpr inside structure
  Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ] ? [A2, C2, [Id], O] : never
      >
    // Empty tuple
    : Value extends readonly []
      ? Expected extends readonly []
        ? [Adj, Ctr, [], []]
        : never
    // Non-empty tuple
    : Value extends readonly [infer H, ...infer Rest]
      ? Expected extends readonly [infer EH, ...infer ERest]
        ? NeverGuard<
            ElaborateLeaf<Reg, H, EH, Adj, Ctr>,
            ElaborateLeaf<Reg, H, EH, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer Ids1 extends string[],
            ]
              ? NeverGuard<
                  ElaborateStructural<Reg, Rest, ERest, A2, C2>,
                  ElaborateStructural<Reg, Rest, ERest, A2, C2> extends [
                    infer A3, infer C3 extends string, infer Ids2 extends string[], any,
                  ] ? [A3, C3, [...Ids1, ...Ids2], Expected] : never
                >
              : never
          >
        : never
    // Record — convert to value tuples using key ordering from Expected
    : Value extends object
      ? Expected extends object
        ? NeverGuard<
            ElaborateStructural<
              Reg,
              ValuesAsTuple<Value, UnionToTuple<keyof Expected>>,
              ValuesAsTuple<Expected, UnionToTuple<keyof Expected>>,
              Adj, Ctr
            >,
            ElaborateStructural<
              Reg,
              ValuesAsTuple<Value, UnionToTuple<keyof Expected>>,
              ValuesAsTuple<Expected, UnionToTuple<keyof Expected>>,
              Adj, Ctr
            > extends [infer A2, infer C2 extends string, infer Ids extends string[], any]
              ? [A2, C2, Ids, Expected]
              : never
          >
        : never
    // Raw primitive — lift
    : Value extends number
      ? [Adj & Record<Ctr, NodeEntry<"num/literal", [], number>>,
         Increment<Ctr>, [Ctr], number]
    : Value extends string
      ? [Adj & Record<Ctr, NodeEntry<"str/literal", [], string>>,
         Increment<Ctr>, [Ctr], string]
    : Value extends boolean
      ? [Adj & Record<Ctr, NodeEntry<"bool/literal", [], boolean>>,
         Increment<Ctr>, [Ctr], boolean]
    : never;

// Helper: elaborate a leaf value in a structure (CExpr, primitive, or sub-structure)
// Returns [Adj, Ctr, ChildIds[]] (no output type — caller handles that)
type ElaborateLeaf<
  Reg, Value, Expected, Adj, Ctr extends string,
> =
  Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ]
          ? O extends Expected ? [A2, C2, [Id]] : never
          : never
      >
    : [LiftKind<Expected>] extends [never]
      // Expected is structural — recurse, strip output type
      ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Ids extends string[], any,
        ] ? [A2, C2, Ids] : never
      // Expected is a primitive
      : Value extends Expected
        ? [Adj & Record<Ctr, NodeEntry<LiftKind<Expected>, [], Expected>>,
           Increment<Ctr>, [Ctr]]
        : DeepResolve<Value> extends Expected
          ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer Ids extends string[], any,
            ] ? [A2, C2, Ids] : never
          : never;

// ─── ElaborateExpr (re-implemented to use structural ElaborateArg) ───
type ElaborateExpr<
  Reg, Kind extends string, Args extends readonly unknown[],
  Adj, Ctr extends string,
> =
  Kind extends keyof Reg
    ? Reg[Kind] extends KindSpec<infer Inputs extends readonly unknown[], infer O>
      ? NeverGuard<
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr>,
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr> extends [
            infer A2, infer C2 extends string, infer Ids extends string[],
          ]
            ? [A2 & Record<C2, NodeEntry<Kind, Ids, O>>,
               Increment<C2>, C2, O]
            : never
        >
      : never
    : never;

// ─── ElaborateChildren: each arg returns ChildIds[], we spread them ──
type ElaborateChildren<
  Reg, Args extends readonly unknown[], Expected extends readonly unknown[],
  Adj, Ctr extends string,
> =
  Args extends readonly []
    ? Expected extends readonly [] ? [Adj, Ctr, []] : never
    : Args extends readonly [infer AH, ...infer AT extends readonly unknown[]]
      ? Expected extends readonly [infer EH, ...infer ET extends readonly unknown[]]
        ? NeverGuard<
            ElaborateArg<Reg, AH, EH, Adj, Ctr>,
            ElaborateArg<Reg, AH, EH, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer Ids0 extends string[], any,
            ]
              ? NeverGuard<
                  ElaborateChildren<Reg, AT, ET, A2, C2>,
                  ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                    infer A3, infer C3 extends string, infer Ids1 extends string[],
                  ] ? [A3, C3, [...Ids0, ...Ids1]] : never
                >
              : never
          >
        : never
      : never;

// ─── AppResult ───────────────────────────────────────────────────────
type AppResult<Expr> =
  Expr extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<StructuralRegistry, K, A, {}, "a">,
        ElaborateExpr<StructuralRegistry, K, A, {}, "a"> extends [
          infer Adj, infer C extends string, infer R extends string, infer O,
        ]
          ? NExpr<O, R, Adj, C>
          : never
      >
    : never;

// ═══════════════════════════════════════════════════════════════════════
// CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════

function point<A extends { x: unknown; y: unknown }>(
  a: A,
): CExpr<{ x: number; y: number }, "geom/point", [A]> {
  return makeCExpr("geom/point", [a]);
}

function line<A extends { start: unknown; end: unknown }>(
  a: A,
): CExpr<
  { start: { x: number; y: number }; end: { x: number; y: number } },
  "geom/line", [A]
> {
  return makeCExpr("geom/line", [a]);
}

function pair<A, B>(a: A, b: B): CExpr<[number, number], "data/pair", [[A, B]]> {
  return makeCExpr("data/pair", [[a, b]]);
}

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME: structural-aware app()
// ═══════════════════════════════════════════════════════════════════════

const LIFT_MAP: Record<string, string> = {
  number: "num/literal",
  string: "str/literal",
  boolean: "bool/literal",
};

const KIND_INPUTS: Record<string, string[] | "structural"> = {
  "num/add": ["number", "number"],
  "num/mul": ["number", "number"],
  "geom/point": "structural",
  "geom/line": "structural",
  "data/pair": "structural",
};

// Expected structural shapes for validation
const STRUCTURAL_SHAPES: Record<string, unknown> = {
  "geom/point": { x: "number", y: "number" },
  "geom/line": {
    start: { x: "number", y: "number" },
    end: { x: "number", y: "number" },
  },
  "data/pair": ["number", "number"],
};

function appS<Expr extends CExpr<any, string, readonly unknown[]>>(
  expr: Expr,
): AppResult<Expr> {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  // Visit a structural value, elaborate CExprs and lift primitives
  function visitStructural(
    value: unknown,
    shape: unknown,
  ): string[] {
    if (isCExpr(value)) {
      const [id] = visit(value);
      return [id];
    }
    if (Array.isArray(shape) && Array.isArray(value)) {
      const ids: string[] = [];
      for (let i = 0; i < value.length; i++) {
        ids.push(...visitStructural(value[i], shape[i]));
      }
      return ids;
    }
    if (typeof shape === "object" && shape !== null && !Array.isArray(shape)) {
      const ids: string[] = [];
      for (const key of Object.keys(shape as object).sort()) {
        ids.push(
          ...visitStructural(
            (value as Record<string, unknown>)[key],
            (shape as Record<string, unknown>)[key],
          ),
        );
      }
      return ids;
    }
    // Primitive — lift
    const typeTag = typeof value;
    const liftKind = LIFT_MAP[typeTag];
    if (!liftKind) throw new Error(`Cannot lift ${typeTag}`);
    if (shape !== typeTag) throw new Error(`Expected ${shape}, got ${typeTag}`);
    const nodeId = counter;
    counter = incrementId(counter);
    entries[nodeId] = { kind: liftKind, children: [], out: value };
    return [nodeId];
  }

  function visit(arg: unknown): [string, string] {
    if (!isCExpr(arg)) throw new Error("visit expects CExpr");
    const cexpr = arg as CExpr<unknown>;
    const kind = cexpr.__kind;
    const args = cexpr.__args;

    const inputSpec = KIND_INPUTS[kind];
    if (inputSpec === "structural") {
      const shape = STRUCTURAL_SHAPES[kind];
      // Structural kinds: single arg that's a structure
      const childIds = visitStructural(args[0], shape);
      const nodeId = counter;
      counter = incrementId(counter);
      entries[nodeId] = { kind, children: childIds, out: undefined };
      return [nodeId, "object"];
    }

    // Regular kind
    const expectedInputs = inputSpec as string[] | undefined;
    const childIds: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const exp = expectedInputs ? expectedInputs[i] : undefined;
      if (isCExpr(args[i])) {
        const [childId, childType] = visit(args[i]);
        if (exp && childType !== exp) {
          throw new Error(`${kind}: expected ${exp} for arg ${i}, got ${childType}`);
        }
        childIds.push(childId);
      } else {
        const typeTag = typeof args[i];
        if (exp && typeTag !== exp) {
          throw new Error(`Expected ${exp}, got ${typeTag}`);
        }
        const liftKind = LIFT_MAP[typeTag];
        if (!liftKind) throw new Error(`Cannot lift ${typeTag}`);
        const nodeId = counter;
        counter = incrementId(counter);
        entries[nodeId] = { kind: liftKind, children: [], out: args[i] };
        childIds.push(nodeId);
      }
    }
    const nodeId = counter;
    counter = incrementId(counter);
    const outputType = kind.startsWith("num/") ? "number" : "object";
    entries[nodeId] = { kind, children: childIds, out: undefined };
    return [nodeId, outputType];
  }

  const [rootId] = visit(expr);
  return makeNExpr(rootId, entries, counter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

import type { IdOf, AdjOf, OutOf } from "./04-normalize";
type AssertNever<T extends never> = T;

// --- point({x: 3, y: 4}): all primitives ---
const p1 = appS(point({ x: 3, y: 4 }));
type P1Adj = AdjOf<typeof p1>;
const _p1x: P1Adj["a"]["kind"] = "num/literal";
const _p1y: P1Adj["b"]["kind"] = "num/literal";
const _p1p: P1Adj["c"]["kind"] = "geom/point";
const _p1ch: P1Adj["c"]["children"] = ["a", "b"];

// --- point({x: add(1,2), y: 3}): CExpr mixed with primitive ---
const p2 = appS(point({ x: add(1, 2), y: 3 }));
type P2Adj = AdjOf<typeof p2>;
const _p2a: P2Adj["a"]["kind"] = "num/literal";
const _p2b: P2Adj["b"]["kind"] = "num/literal";
const _p2c: P2Adj["c"]["kind"] = "num/add";
const _p2d: P2Adj["d"]["kind"] = "num/literal";
const _p2e: P2Adj["e"]["kind"] = "geom/point";
const _p2ch: P2Adj["e"]["children"] = ["c", "d"];

// --- pair(add(1,2), 3): tuple with CExpr ---
const p3 = appS(pair(add(1, 2), 3));
type P3Adj = AdjOf<typeof p3>;
const _p3c: P3Adj["c"]["kind"] = "num/add";
const _p3d: P3Adj["d"]["kind"] = "num/literal";
const _p3e: P3Adj["e"]["kind"] = "data/pair";
const _p3ch: P3Adj["e"]["children"] = ["c", "d"];

// --- line({start: {x: 1, y: 2}, end: {x: add(3,4), y: 5}}): nested records ---
const p4 = appS(line({ start: { x: 1, y: 2 }, end: { x: add(3, 4), y: 5 } }));
type P4Adj = AdjOf<typeof p4>;
// Keys processed alphabetically: "end" before "start", "x" before "y"
const _p4a: P4Adj["a"]["kind"] = "num/literal"; // end.x arg 1 = 3
const _p4b: P4Adj["b"]["kind"] = "num/literal"; // end.x arg 2 = 4
const _p4c: P4Adj["c"]["kind"] = "num/add";     // end.x = add(3,4)
const _p4d: P4Adj["d"]["kind"] = "num/literal"; // end.y = 5
const _p4e: P4Adj["e"]["kind"] = "num/literal"; // start.x = 1
const _p4f: P4Adj["f"]["kind"] = "num/literal"; // start.y = 2
const _p4g: P4Adj["g"]["kind"] = "geom/line";
const _p4ch: P4Adj["g"]["children"] = ["c", "d", "e", "f"];

// --- NEGATIVE: point({x: "wrong", y: 3}) → never ---
type _BadPoint = AssertNever<
  AppResult<ReturnType<typeof point<{ x: "wrong"; y: 3 }>>>
>;

// --- NEGATIVE: point({x: mul(add(1,2), 3), y: add(false, "bad")}) → never ---
// The inner add(false, "bad") is invalid even though mul's output is number
type _BadNested = AssertNever<
  AppResult<
    ReturnType<
      typeof point<{
        x: ReturnType<typeof mul<ReturnType<typeof add<1, 2>>, 3>>;
        y: ReturnType<typeof add<false, "bad">>;
      }>
    >
  >
>;

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

// point({x: 3, y: 4})
assert(p1.__adj["a"].kind === "num/literal", "p1: x literal");
assert(p1.__adj["a"].out === 3, "p1: x = 3");
assert(p1.__adj["b"].kind === "num/literal", "p1: y literal");
assert(p1.__adj["b"].out === 4, "p1: y = 4");
assert(p1.__adj["c"].kind === "geom/point", "p1: point node");
assert(
  JSON.stringify(p1.__adj["c"].children) === '["a","b"]',
  "p1: children [a,b]",
);

// point({x: add(1,2), y: 3})
assert(p2.__adj["c"].kind === "num/add", "p2: add node");
assert(p2.__adj["d"].out === 3, "p2: y literal");
assert(p2.__adj["e"].kind === "geom/point", "p2: point node");
assert(
  JSON.stringify(p2.__adj["e"].children) === '["c","d"]',
  "p2: children [c,d]",
);

// pair(add(1,2), 3)
assert(p3.__adj["e"].kind === "data/pair", "p3: pair node");
assert(
  JSON.stringify(p3.__adj["e"].children) === '["c","d"]',
  "p3: children [c,d]",
);

// line with nested records
assert(p4.__adj["g"].kind === "geom/line", "p4: line node");
assert(p4.__adj["c"].kind === "num/add", "p4: add inside end.x");
assert(Object.keys(p4.__adj).length === 7, "p4: 7 total nodes");

// Runtime error: point({x: "wrong", y: 3})
let threwBadPoint = false;
try {
  appS(point({ x: "wrong", y: 3 }) as any);
} catch {
  threwBadPoint = true;
}
assert(threwBadPoint, "point({x:'wrong'}) throws at runtime");

console.log(`\n04a-structural: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
