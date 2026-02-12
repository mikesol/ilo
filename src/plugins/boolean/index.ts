import type { PluginDefinition } from "../../core";

export type BooleanMethods = {};

export const boolean: PluginDefinition<BooleanMethods> = {
  name: "boolean",
  nodeKinds: [
    "boolean/and",
    "boolean/or",
    "boolean/not",
    "boolean/eq",
    "boolean/ff",
    "boolean/tt",
    "boolean/implies",
  ],
  traits: {
    eq: { type: "boolean", nodeKinds: { eq: "boolean/eq" } },
    heytingAlgebra: {
      type: "boolean",
      nodeKinds: {
        conj: "boolean/and",
        disj: "boolean/or",
        not: "boolean/not",
        ff: "boolean/ff",
        tt: "boolean/tt",
        implies: "boolean/implies",
      },
    },
  },
  build(): BooleanMethods {
    return {};
  },
};
