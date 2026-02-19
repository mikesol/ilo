import { describe, it, expect } from "vitest";
import { makeNExpr } from "../../src/dag/00-expr";
import type { RuntimeEntry } from "../../src/dag/00-expr";
import { fold, foldFrom } from "../../src/dag/fold";
import type { Interpreter } from "../../src/dag/fold";

describe("fold — fiber parallelism", () => {
  it("foldFrom evaluates a sub-expression independently", async () => {
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
    // foldFrom can evaluate any sub-tree
    expect(await foldFrom("a", adj, interp)).toBe(3);
    expect(await foldFrom("c", adj, interp)).toBe(7);
  });

  it("fiber/par evaluates children in parallel", async () => {
    const order: string[] = [];
    const adj: Record<string, RuntimeEntry> = {
      a: {
        kind: "async/delay",
        children: [],
        out: { ms: 50, value: "first" },
      },
      b: {
        kind: "async/delay",
        children: [],
        out: { ms: 10, value: "second" },
      },
      c: { kind: "fiber/par", children: ["a", "b"], out: undefined },
    };
    const interp: Interpreter = {
      "async/delay": async function* (entry) {
        const { ms, value } = entry.out as { ms: number; value: string };
        await new Promise((r) => setTimeout(r, ms));
        order.push(value);
        return value;
      },
      "fiber/par": async function* (entry) {
        // Spawn parallel fold for each child
        const results = await Promise.all(
          entry.children.map((childId) => foldFrom(childId, adj, interp)),
        );
        return results;
      },
    };
    const expr = makeNExpr("c", adj, "d");
    const result = await fold(expr, interp);
    expect(result).toEqual(["first", "second"]);
    // "second" finishes first (10ms) but results are in child order
    expect(order).toEqual(["second", "first"]);
  });

  it("parallel fibers have independent memos", async () => {
    let evalCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
      // fiber/par2 evaluates "b" twice in parallel — each gets its own memo
      c: { kind: "fiber/par2", children: ["b", "b"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        evalCount++;
        return entry.out;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "fiber/par2": async function* (entry) {
        const results = await Promise.all(
          entry.children.map((childId) => foldFrom(childId, adj, interp)),
        );
        return results;
      },
    };
    const expr = makeNExpr("c", adj, "d");
    const result = await fold(expr, interp);
    expect(result).toEqual([10, 10]);
    // Each parallel fold has its own memo, so "a" is evaluated once per fiber = 2
    expect(evalCount).toBe(2);
  });

  it("fold still works normally (foldFrom refactor is transparent)", async () => {
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
