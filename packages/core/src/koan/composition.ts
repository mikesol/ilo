import {
  add,
  boolLit,
  eq,
  makeCExpr,
  mul,
  numLit,
  strLit,
  sub,
  type CExpr,
  type KindSpec,
  type RuntimeEntry,
} from "./expr";

/** Trait declaration shape used by unified plugins. */
export interface TraitDef<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

/** Koan handler protocol. */
export type Handler = (entry: RuntimeEntry) => AsyncGenerator<number | string, unknown, unknown>;

/** Koan interpreter map. */
export type Interpreter = Record<string, Handler>;

/** Unified koan plugin definition. */
export interface Plugin {
  readonly name: string;
  readonly ctors: Record<string, unknown>;
  readonly kinds: Record<string, KindSpec<readonly unknown[], unknown>>;
  readonly traits: Record<string, TraitDef<unknown, Record<string, string>>>;
  readonly lifts: Record<string, string>;
  readonly nodeKinds: readonly string[];
  readonly defaultInterpreter?: () => Interpreter;
}

/** Build literal lift map from plugin tuple. */
export function buildLiftMap(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) {
    Object.assign(m, p.lifts);
  }
  return m;
}

/** Build trait map from plugin tuple. */
export function buildTraitMap(plugins: readonly Plugin[]): Record<string, Record<string, string>> {
  const m: Record<string, Record<string, string>> = {};
  for (const p of plugins) {
    for (const [traitName, traitDef] of Object.entries(p.traits)) {
      if (!(traitName in m)) {
        m[traitName] = {};
      }
      Object.assign(m[traitName], traitDef.mapping);
    }
  }
  return m;
}

/** Build kind input type names from plugin tuple. */
export function buildKindInputs(plugins: readonly Plugin[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = spec.inputs.map((v) => typeof v);
    }
  }
  return m;
}

/** Compose unified plugins into a constructor surface with trait ctors. */
export function mvfmU<const P extends readonly Plugin[]>(...plugins: P): Record<string, unknown> {
  const allCtors: Record<string, unknown> = {};
  const traitNames = new Set<string>();
  for (const p of plugins) {
    Object.assign(allCtors, p.ctors);
    for (const t of Object.keys(p.traits)) {
      traitNames.add(t);
    }
  }
  for (const t of traitNames) {
    if (!(t in allCtors)) {
      allCtors[t] = <A, B>(a: A, b: B): CExpr<boolean, string, [A, B]> => makeCExpr(t, [a, b]);
    }
  }
  return allCtors;
}

/** Trait-level less-than constructor. */
export function lt<A, B>(a: A, b: B): CExpr<boolean, "lt", [A, B]> {
  return makeCExpr("lt", [a, b]);
}

/** Unified number plugin. */
export const numPluginU: Plugin = {
  name: "num",
  ctors: { add, mul, sub, numLit },
  kinds: {
    "num/literal": { inputs: [], output: 0 },
    "num/add": { inputs: [0, 0], output: 0 },
    "num/mul": { inputs: [0, 0], output: 0 },
    "num/sub": { inputs: [0, 0], output: 0 },
    "num/eq": { inputs: [0, 0], output: false },
  },
  traits: {
    eq: { output: false, mapping: { number: "num/eq" } },
  },
  lifts: { number: "num/literal" },
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub", "num/eq"],
};

/** Unified string plugin. */
export const strPluginU: Plugin = {
  name: "str",
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" },
    "str/eq": { inputs: ["", ""], output: false },
  },
  traits: {
    eq: { output: false, mapping: { string: "str/eq" } },
  },
  lifts: { string: "str/literal" },
  nodeKinds: ["str/literal", "str/eq"],
};

/** Unified boolean plugin. */
export const boolPluginU: Plugin = {
  name: "bool",
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false },
    "bool/eq": { inputs: [false, false], output: false },
  },
  traits: {
    eq: { output: false, mapping: { boolean: "bool/eq" } },
  },
  lifts: { boolean: "bool/literal" },
  nodeKinds: ["bool/literal", "bool/eq"],
};

/** Canonical std plugin tuple for koan 03a. */
export const stdPlugins = [numPluginU, strPluginU, boolPluginU] as const;

/** Unified ord plugin proving extensibility. */
export const ordPlugin: Plugin = {
  name: "ord",
  ctors: { lt },
  kinds: {
    "num/lt": { inputs: [0, 0], output: false },
    "str/lt": { inputs: ["", ""], output: false },
  },
  traits: {
    lt: { output: false, mapping: { number: "num/lt", string: "str/lt" } },
  },
  lifts: {},
  nodeKinds: ["num/lt", "str/lt"],
};

export { add, eq, mul, sub, numLit, strLit, boolLit, makeCExpr };
