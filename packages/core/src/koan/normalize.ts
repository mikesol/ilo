import {
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  type Plugin,
  type RegistryOf,
  stdPlugins,
} from "./composition";
import {
  type CExpr,
  isCExpr,
  type KindSpec,
  type LiftKind,
  makeNExpr,
  type NExpr,
  type NodeEntry,
  type RuntimeEntry,
  type TraitKindSpec,
  type TypeKey,
} from "./expr";
import type { Increment } from "./increment";
import { incrementId } from "./increment";

/** Replace `never` with `never`-preserving branching in recursive conditionals. */
export type NeverGuard<T, Then> = [T] extends [never] ? never : Then;

// AppResult type-level elaboration (koan 04 core)

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  Arg extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2,
          infer C2 extends string,
          infer Id extends string,
          infer O,
        ]
          ? O extends Expected
            ? [A2, C2, Id, O]
            : never
          : never
      >
    : Arg extends Expected
      ? LiftKind<Expected> extends infer LK extends string
        ? [Adj & Record<Ctr, NodeEntry<LK, [], Expected>>, Increment<Ctr>, Ctr, Expected]
        : never
      : never;

type ElaborateChildren<
  Reg,
  Args extends readonly unknown[],
  Expected extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Args extends readonly []
  ? Expected extends readonly []
    ? [Adj, Ctr, []]
    : never
  : Args extends readonly [infer AH, ...infer AT extends readonly unknown[]]
    ? Expected extends readonly [infer EH, ...infer ET extends readonly unknown[]]
      ? NeverGuard<
          ElaborateArg<Reg, AH, EH, Adj, Ctr>,
          ElaborateArg<Reg, AH, EH, Adj, Ctr> extends [
            infer A2,
            infer C2 extends string,
            infer Id extends string,
            unknown,
          ]
            ? NeverGuard<
                ElaborateChildren<Reg, AT, ET, A2, C2>,
                ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                  infer A3,
                  infer C3 extends string,
                  infer Ids extends string[],
                ]
                  ? [A3, C3, [Id, ...Ids]]
                  : never
              >
            : never
        >
      : never
    : never;

type ElaborateArgInfer<Reg, Arg, Adj, Ctr extends string> =
  Arg extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
    ? ElaborateExpr<Reg, K, A, Adj, Ctr>
    : Arg extends number
      ? [Adj & Record<Ctr, NodeEntry<"num/literal", [], number>>, Increment<Ctr>, Ctr, number]
      : Arg extends string
        ? [Adj & Record<Ctr, NodeEntry<"str/literal", [], string>>, Increment<Ctr>, Ctr, string]
        : Arg extends boolean
          ? [
              Adj & Record<Ctr, NodeEntry<"bool/literal", [], boolean>>,
              Increment<Ctr>,
              Ctr,
              boolean,
            ]
          : never;

type ElaborateTraitExpr<
  Reg,
  O,
  Mapping,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Args extends readonly [infer A, infer B]
  ? NeverGuard<
      ElaborateArgInfer<Reg, A, Adj, Ctr>,
      ElaborateArgInfer<Reg, A, Adj, Ctr> extends [
        infer A2,
        infer C2 extends string,
        infer Id1 extends string,
        infer T1,
      ]
        ? NeverGuard<
            ElaborateArg<Reg, B, T1, A2, C2>,
            ElaborateArg<Reg, B, T1, A2, C2> extends [
              infer A3,
              infer C3 extends string,
              infer Id2 extends string,
              unknown,
            ]
              ? TypeKey<T1> extends infer TK extends string
                ? TK extends keyof Mapping
                  ? Mapping[TK] extends infer RK extends string
                    ? [A3 & Record<C3, NodeEntry<RK, [Id1, Id2], O>>, Increment<C3>, C3, O]
                    : never
                  : never
                : never
              : never
          >
        : never
    >
  : never;

type ElaborateExpr<
  Reg,
  Kind extends string,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Kind extends keyof Reg
  ? Reg[Kind] extends KindSpec<infer Inputs extends readonly unknown[], infer O>
    ? NeverGuard<
        ElaborateChildren<Reg, Args, Inputs, Adj, Ctr>,
        ElaborateChildren<Reg, Args, Inputs, Adj, Ctr> extends [
          infer A2,
          infer C2 extends string,
          infer Ids extends string[],
        ]
          ? [A2 & Record<C2, NodeEntry<Kind, Ids, O>>, Increment<C2>, C2, O]
          : never
      >
    : Reg[Kind] extends TraitKindSpec<infer O, infer Mapping>
      ? ElaborateTraitExpr<Reg, O, Mapping, Args, Adj, Ctr>
      : never
  : never;

/** Type-level result of elaborating a permissive CExpr. */
export type AppResult<Reg, Expr> =
  Expr extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, {}, "a">,
        ElaborateExpr<Reg, K, A, {}, "a"> extends [
          infer Adj,
          infer C extends string,
          infer R extends string,
          infer O,
        ]
          ? NExpr<O, R, Adj, C>
          : never
      >
    : never;

function buildKindOutputs(plugins: readonly Plugin[]): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      outputs[kind] = typeof spec.output;
    }
  }
  return outputs;
}

function elaborate(
  expr: CExpr<unknown>,
  liftMap: Record<string, string>,
  traitMap: Record<string, Record<string, string>>,
  kindInputs: Record<string, string[]>,
  kindOutputs: Record<string, string>,
): NExpr<unknown, string, Record<string, RuntimeEntry>, string> {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  function alloc(): string {
    const id = counter;
    counter = incrementId(counter);
    return id;
  }

  function visitValue(value: unknown, expectedTag?: string): { id: string; outType: string } {
    if (isCExpr(value)) {
      return visitExpr(value as CExpr<unknown>, expectedTag);
    }
    if (Array.isArray(value)) {
      const childIds = value.map((v) => visitValue(v).id);
      const id = alloc();
      entries[id] = { kind: "core/tuple", children: [], out: childIds };
      return { id, outType: "object" };
    }
    if (value !== null && typeof value === "object") {
      const childMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(value)) {
        childMap[k] = visitValue(v).id;
      }
      const id = alloc();
      entries[id] = { kind: "core/record", children: [], out: childMap };
      return { id, outType: "object" };
    }

    const tag = typeof value;
    if (expectedTag && expectedTag !== tag) {
      throw new Error(`Expected ${expectedTag}, got ${tag}`);
    }
    const liftKind = liftMap[tag];
    if (!liftKind) {
      throw new Error(`No lift kind for ${tag}`);
    }
    const id = alloc();
    entries[id] = { kind: liftKind, children: [], out: value };
    return { id, outType: tag };
  }

  function visitExpr(node: CExpr<unknown>, expectedTag?: string): { id: string; outType: string } {
    const kind = node.__kind;
    const args = node.__args;

    if (kind in traitMap) {
      const left = visitValue(args[0]);
      const right = visitValue(args[1], left.outType);
      const resolved = traitMap[kind]?.[left.outType];
      if (!resolved) throw new Error(`No ${kind} implementation for type: ${left.outType}`);
      const id = alloc();
      entries[id] = { kind: resolved, children: [left.id, right.id], out: undefined };
      return { id, outType: kindOutputs[resolved] ?? expectedTag ?? "unknown" };
    }

    const expectedInputs = kindInputs[kind] ?? [];
    const childIds = args.map((arg, i) => visitValue(arg, expectedInputs[i]).id);
    const id = alloc();
    entries[id] = { kind, children: childIds, out: undefined };
    return { id, outType: kindOutputs[kind] ?? expectedTag ?? "unknown" };
  }

  const root = visitExpr(expr);
  return makeNExpr(root.id, entries, counter);
}

/** Create a normalize app from a plugin tuple. */
export function createApp<const P extends readonly Plugin[]>(...plugins: P) {
  const liftMap = buildLiftMap(plugins);
  const traitMap = buildTraitMap(plugins);
  const kindInputs = buildKindInputs(plugins);
  const kindOutputs = buildKindOutputs(plugins);

  return function app<Expr extends CExpr<unknown>>(expr: Expr): AppResult<RegistryOf<P>, Expr> {
    return elaborate(expr, liftMap, traitMap, kindInputs, kindOutputs) as AppResult<
      RegistryOf<P>,
      Expr
    >;
  };
}

/** Std-plugin app for koan normalize behavior. */
export const app = createApp(...stdPlugins);
/** Std-plugin lift map. */
export const LIFT_MAP = buildLiftMap(stdPlugins);
/** Std-plugin trait map. */
export const TRAIT_MAP = buildTraitMap(stdPlugins);
/** Std-plugin kind-input map. */
export const KIND_INPUTS = buildKindInputs(stdPlugins);
