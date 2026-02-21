/**
 * Koan-model expression primitives (00-02).
 */

/** One normalized adjacency entry. */
export type NodeEntry<Kind extends string, ChildIDs extends string[], Out> = {
  readonly kind: Kind;
  readonly children: ChildIDs;
  readonly out: Out;
};

/** Runtime adjacency entry. */
export interface RuntimeEntry {
  kind: string;
  children: string[];
  out: unknown;
}

/** CExpr runtime brand marker. */
export const CREF = Symbol.for("mvfm/cref");

declare const cexprBrand: unique symbol;

/** Permissive construction-time expression node. */
export interface CExpr<
  O,
  Kind extends string = string,
  Args extends readonly unknown[] = readonly unknown[],
> {
  readonly [cexprBrand]: { readonly o: O; readonly kind: Kind; readonly args: Args };
  readonly [CREF]: true;
  readonly __kind: Kind;
  readonly __args: readonly unknown[];
}

/** Build a permissive construction expression. */
export function makeCExpr<O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: [...Args],
): CExpr<O, Kind, Args> {
  return {
    [CREF]: true,
    __kind: kind,
    __args: args,
  } as unknown as CExpr<O, Kind, Args>;
}

/** Runtime CExpr detector. */
export function isCExpr(x: unknown): x is CExpr<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    CREF in x &&
    (x as { [CREF]?: unknown })[CREF] === true
  );
}

/** Extract CExpr output type. */
export type COutOf<E> = E extends CExpr<infer O, string, readonly unknown[]> ? O : never;
/** Extract CExpr kind. */
export type CKindOf<E> = E extends CExpr<unknown, infer K, readonly unknown[]> ? K : never;
/** Extract CExpr arg tuple type. */
export type CArgsOf<E> = E extends CExpr<unknown, string, infer A> ? A : never;

declare const nexprBrand: unique symbol;

/** Normalized expression graph root. */
export interface NExpr<O, RootId extends string, Adj, Ctr extends string> {
  readonly [nexprBrand]: {
    readonly o: O;
    readonly rootId: RootId;
    readonly adj: Adj;
    readonly ctr: Ctr;
  };
  readonly __id: string;
  readonly __adj: Record<string, RuntimeEntry>;
  readonly __counter: string;
}

/** Build a normalized expression value. */
export function makeNExpr<O, RootId extends string, Adj, Ctr extends string>(
  rootId: RootId,
  adj: Record<string, RuntimeEntry>,
  counter: Ctr,
): NExpr<O, RootId, Adj, Ctr> {
  return {
    __id: rootId,
    __adj: adj,
    __counter: counter,
  } as unknown as NExpr<O, RootId, Adj, Ctr>;
}

/** Registry spec for a concrete kind. */
export interface KindSpec<I extends readonly unknown[], O> {
  readonly inputs: I;
  readonly output: O;
}

/** Registry spec for a trait kind mapping. */
export interface TraitKindSpec<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

/** Numeric add constructor. */
export function add<A, B>(a: A, b: B): CExpr<number, "num/add", [A, B]> {
  return makeCExpr("num/add", [a, b]);
}

/** Numeric multiply constructor. */
export function mul<A, B>(a: A, b: B): CExpr<number, "num/mul", [A, B]> {
  return makeCExpr("num/mul", [a, b]);
}

/** Numeric subtraction constructor. */
export function sub<A, B>(a: A, b: B): CExpr<number, "num/sub", [A, B]> {
  return makeCExpr("num/sub", [a, b]);
}

/** Trait-level equality constructor. */
export function eq<A, B>(a: A, b: B): CExpr<boolean, "eq", [A, B]> {
  return makeCExpr("eq", [a, b]);
}

/** Number literal passthrough constructor. */
export function numLit<V extends number>(v: V): V {
  return v;
}

/** String literal passthrough constructor. */
export function strLit<V extends string>(v: V): V {
  return v;
}

/** Boolean literal passthrough constructor. */
export function boolLit<V extends boolean>(v: V): V {
  return v;
}
