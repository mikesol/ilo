import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "boolean/and": {
    description: "Logical AND — both conditions must be true",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.and($.gt($.input.x, 0), $.gt($.input.y, 0));
});
await foldAST(defaults(app), injectInput(prog, { x: 5, y: 3 }));`,
  },
  "boolean/or": {
    description: "Logical OR — at least one condition must be true",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.or($.gt($.input.x, 10), $.gt($.input.y, 10));
});
await foldAST(defaults(app), injectInput(prog, { x: 3, y: 15 }));`,
  },
  "boolean/not": {
    description: "Logical NOT — negates a boolean expression",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  const isSmall = $.lt($.input.x, 10);
  return $.not(isSmall);
});
await foldAST(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "boolean/eq": {
    description: "Boolean equality — compares two boolean expressions",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  // Wrap in $.not to produce boolean-typed nodes for eq dispatch
  const xNeg = $.not($.gt($.input.x, 0));
  const yNeg = $.not($.gt($.input.y, 0));
  return $.eq(xNeg, yNeg);
});
await foldAST(defaults(app), injectInput(prog, { x: 5, y: -3 }));`,
  },
  "boolean/ff": {
    description: "Boolean false literal — the heytingAlgebra identity for disjunction",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // false auto-lifts to a boolean literal
  return $.or($.gt($.input.x, 100), false);
});
await foldAST(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "boolean/tt": {
    description: "Boolean true literal — the heytingAlgebra identity for conjunction",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // true auto-lifts to a boolean literal
  return $.and(true, $.gt($.input.x, 0));
});
await foldAST(defaults(app), injectInput(prog, { x: 7 }));`,
  },
  "boolean/implies": {
    description: "Logical implication — if A then B, equivalent to or(not(A), B)",
    code: `const app = mvfm(prelude);
const prog = app({ age: "number" }, ($) => {
  const isAdult = $.gte($.input.age, 18);
  const canDrive = $.gte($.input.age, 16);
  // A implies B is equivalent to or(not(A), B)
  return $.or($.not(isAdult), canDrive);
});
await foldAST(defaults(app), injectInput(prog, { age: 21 }));`,
  },
  "boolean/show": {
    description: "Convert a boolean to its string representation via the Show typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Wrap in $.not($.not(...)) to produce a boolean-typed node for show dispatch
  const isPositive = $.not($.not($.gt($.input.x, 0)));
  // $.show dispatches to boolean/show for boolean expressions
  return $.concat("positive: ", $.show(isPositive));
});
await foldAST(defaults(app), injectInput(prog, { x: 5 }));`,
  },
  "boolean/top": {
    description: "Bounded top for boolean — the maximum value (true)",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // true is the top (maximum) of the boolean bounded type
  return $.and(true, $.gt($.input.x, 0));
});
await foldAST(defaults(app), injectInput(prog, { x: 10 }));`,
  },
  "boolean/bottom": {
    description: "Bounded bottom for boolean — the minimum value (false)",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // false is the bottom (minimum) of the boolean bounded type
  return $.or(false, $.gt($.input.x, 0));
});
await foldAST(defaults(app), injectInput(prog, { x: 3 }));`,
  },
};

export default examples;
