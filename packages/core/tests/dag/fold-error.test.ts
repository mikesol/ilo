import { describe, it, expect } from "vitest";
import { makeNExpr } from "../../src/dag/00-expr";
import type { RuntimeEntry } from "../../src/dag/00-expr";
import { fold } from "../../src/dag/fold";
import type { Interpreter } from "../../src/dag/fold";

describe("fold — error propagation", () => {
  it("error/fail throws and propagates to fold caller", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "error/fail", children: [], out: "boom" },
    };
    const interp: Interpreter = {
      "error/fail": async function* (entry) {
        throw new Error(entry.out as string);
      },
    };
    const expr = makeNExpr("a", adj, "b");
    await expect(fold(expr, interp)).rejects.toThrow("boom");
  });

  it("error/try catches error from child", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "error/fail", children: [], out: "oops" },
      b: { kind: "num/literal", children: [], out: 42 },
      c: { kind: "error/try", children: ["a", "b"], out: undefined },
    };
    const interp: Interpreter = {
      "error/fail": async function* (entry) {
        throw new Error(entry.out as string);
      },
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "error/try": async function* (_entry) {
        try {
          return yield 0;
        } catch {
          return yield 1;
        }
      },
    };
    const expr = makeNExpr("c", adj, "d");
    const result = await fold(expr, interp);
    expect(result).toBe(42);
  });

  it("error propagates through non-catching parent", async () => {
    // fail → add → try (add doesn't catch, try does)
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "error/fail", children: [], out: "deep" },
      b: { kind: "num/literal", children: [], out: 5 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
      d: { kind: "num/literal", children: [], out: 99 },
      e: { kind: "error/try", children: ["c", "d"], out: undefined },
    };
    const interp: Interpreter = {
      "error/fail": async function* (entry) {
        throw new Error(entry.out as string);
      },
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "num/add": async function* () {
        const l = (yield 0) as number;
        const r = (yield 1) as number;
        return l + r;
      },
      "error/try": async function* () {
        try {
          return yield 0;
        } catch {
          return yield 1;
        }
      },
    };
    const expr = makeNExpr("e", adj, "f");
    const result = await fold(expr, interp);
    expect(result).toBe(99);
  });

  it("error/try can re-throw", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "error/fail", children: [], out: "rethrown" },
      b: {
        kind: "error/try-rethrow",
        children: ["a"],
        out: undefined,
      },
    };
    const interp: Interpreter = {
      "error/fail": async function* (entry) {
        throw new Error(entry.out as string);
      },
      "error/try-rethrow": async function* () {
        try {
          return yield 0;
        } catch (e) {
          throw e;
        }
      },
    };
    const expr = makeNExpr("b", adj, "c");
    await expect(fold(expr, interp)).rejects.toThrow("rethrown");
  });

  it("normal evaluation unaffected by error support", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/literal", children: [], out: 4 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const expr = makeNExpr("c", adj, "d");
    expect(await fold(expr, interp)).toBe(7);
  });
});
