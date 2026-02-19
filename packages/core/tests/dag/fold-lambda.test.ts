import { describe, it, expect } from "vitest";
import { makeNExpr } from "../../src/dag/00-expr";
import type { RuntimeEntry } from "../../src/dag/00-expr";
import { fold, VOLATILE_KINDS } from "../../src/dag/fold";
import type { Interpreter, FoldContext } from "../../src/dag/fold";

describe("fold — scoped lambdas", () => {
  it("lambda_param resolves from scope", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "core/lambda_param", children: [], out: "x" },
      c: { kind: "num/add", children: ["b", "b"], out: undefined },
      // "d" applies: evaluate arg (a=10), then evaluate body (c) with scope {x: 10}
      d: { kind: "core/lambda_apply", children: ["a", "c"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "core/lambda_param": async function* (entry, ctx) {
        const scope = ctx.getScope();
        const name = entry.out as string;
        return scope?.[name];
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "core/lambda_apply": async function* () {
        const arg = yield 0;
        const result = yield { child: 1, scope: { x: arg } };
        return result;
      },
    };
    const expr = makeNExpr("d", adj, "e");
    const result = await fold(expr, interp);
    expect(result).toBe(20); // 10 + 10
  });

  it("nested lambda scopes shadow correctly", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "core/lambda_param", children: [], out: "x" },
      // inner apply: eval arg (b=3), eval body (c) with scope {x: 3}
      d: { kind: "core/lambda_apply", children: ["b", "c"], out: undefined },
      // outer apply: eval arg (a=5), eval body (d) with scope {x: 5}
      // But d overrides x to 3 in its inner scope
      e: { kind: "core/lambda_apply", children: ["a", "d"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "core/lambda_param": async function* (entry, ctx) {
        const scope = ctx.getScope();
        return scope?.[entry.out as string];
      },
      "core/lambda_apply": async function* () {
        const arg = yield 0;
        return yield { child: 1, scope: { x: arg } };
      },
    };
    const expr = makeNExpr("e", adj, "f");
    const result = await fold(expr, interp);
    expect(result).toBe(3); // inner scope shadows: x=3
  });

  it("lambda_param is volatile (multiple invocations re-evaluate)", async () => {
    let paramEvals = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "core/lambda_param", children: [], out: "x" },
      c: { kind: "core/lambda_apply", children: ["a", "b"], out: undefined },
      d: { kind: "num/literal", children: [], out: 9 },
      e: { kind: "core/lambda_apply", children: ["d", "b"], out: undefined },
      // sequence both applies
      f: { kind: "pair", children: ["c", "e"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "core/lambda_param": async function* (entry, ctx) {
        paramEvals++;
        return ctx.getScope()?.[entry.out as string];
      },
      "core/lambda_apply": async function* () {
        const arg = yield 0;
        return yield { child: 1, scope: { x: arg } };
      },
      pair: async function* () {
        const a = yield 0;
        const b = yield 1;
        return [a, b];
      },
    };
    const expr = makeNExpr("f", adj, "g");
    const result = await fold(expr, interp);
    expect(result).toEqual([7, 9]);
    expect(paramEvals).toBeGreaterThanOrEqual(2); // volatile, re-evaluates
  });

  it("scope is cleaned up after child completes", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 42 },
      b: { kind: "core/lambda_param", children: [], out: "x" },
      c: { kind: "core/lambda_apply", children: ["a", "b"], out: undefined },
      d: { kind: "scope/check", children: [], out: undefined },
      // After c completes, d checks that scope is empty
      e: { kind: "pair", children: ["c", "d"], out: undefined },
    };
    let scopeAfterLambda: Record<string, unknown> | undefined = undefined;
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "core/lambda_param": async function* (entry, ctx) {
        return ctx.getScope()?.[entry.out as string];
      },
      "core/lambda_apply": async function* () {
        const arg = yield 0;
        return yield { child: 1, scope: { x: arg } };
      },
      "scope/check": async function* (_entry, ctx) {
        scopeAfterLambda = ctx.getScope();
        return null;
      },
      pair: async function* () {
        const a = yield 0;
        const b = yield 1;
        return [a, b];
      },
    };
    const expr = makeNExpr("e", adj, "f");
    await fold(expr, interp);
    expect(scopeAfterLambda).toBeUndefined(); // scope cleaned up
  });

  it("core/lambda_param is in VOLATILE_KINDS", () => {
    expect(VOLATILE_KINDS.has("core/lambda_param")).toBe(true);
  });
});
