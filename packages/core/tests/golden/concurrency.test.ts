import { describe, test, expect } from "vitest";
import {
  fold,
  type RuntimeEntry,
  type Interpreter,
} from "../../src/__koans__/16-bridge";

// ─── Shared interpreters ─────────────────────────────────────────────
const numInterp: Interpreter = {
  "num/literal": async function* (entry) {
    return entry.out as number;
  },
  "num/add": async function* () {
    return ((yield 0) as number) + ((yield 1) as number);
  },
};

describe("concurrency golden tests", () => {
  // ═══════════════════════════════════════════════════════════════════
  // PARALLEL EXECUTION: fiber/par evaluates children, returns array
  // ═══════════════════════════════════════════════════════════════════
  describe("parallel execution (fiber/par)", () => {
    const parInterp: Interpreter = {
      ...numInterp,
      "fiber/par": async function* (entry) {
        const results: unknown[] = [];
        for (let i = 0; i < entry.children.length; i++) {
          results.push(yield i);
        }
        return results;
      },
    };

    test("par with 2 children returns [10, 20]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        p: { kind: "fiber/par", children: ["a", "b"], out: undefined },
      };
      const result = await fold<number[]>("p", adj, parInterp);
      expect(result).toEqual([10, 20]);
    });

    test("par with 3 children returns [1, 2, 3]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 1 },
        b: { kind: "num/literal", children: [], out: 2 },
        c: { kind: "num/literal", children: [], out: 3 },
        p: { kind: "fiber/par", children: ["a", "b", "c"], out: undefined },
      };
      const result = await fold<number[]>("p", adj, parInterp);
      expect(result).toEqual([1, 2, 3]);
    });

    test("par with nested arithmetic children", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/literal", children: [], out: 4 },
        c: { kind: "num/add", children: ["a", "b"], out: undefined },
        d: { kind: "num/literal", children: [], out: 10 },
        p: { kind: "fiber/par", children: ["c", "d"], out: undefined },
      };
      const result = await fold<unknown[]>("p", adj, parInterp);
      expect(result).toEqual([7, 10]);
    });

    test("par with single child returns [value]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        p: { kind: "fiber/par", children: ["a"], out: undefined },
      };
      const result = await fold<number[]>("p", adj, parInterp);
      expect(result).toEqual([42]);
    });

    test("par with zero children returns []", async () => {
      const adj: Record<string, RuntimeEntry> = {
        p: { kind: "fiber/par", children: [], out: undefined },
      };
      const result = await fold<unknown[]>("p", adj, parInterp);
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEQUENTIAL EXECUTION: fiber/seq evaluates children, returns last
  // ═══════════════════════════════════════════════════════════════════
  describe("sequential execution (fiber/seq)", () => {
    const seqInterp: Interpreter = {
      ...numInterp,
      "fiber/seq": async function* (entry) {
        let last: unknown;
        for (let i = 0; i < entry.children.length; i++) {
          last = yield i;
        }
        return last;
      },
    };

    test("seq returns last value", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        c: { kind: "num/literal", children: [], out: 30 },
        s: { kind: "fiber/seq", children: ["a", "b", "c"], out: undefined },
      };
      const result = await fold<number>("s", adj, seqInterp);
      expect(result).toBe(30);
    });

    test("seq evaluates all children via side-effect counting", async () => {
      let count = 0;
      const countingSeqInterp: Interpreter = {
        "num/literal": async function* (entry) {
          count++;
          return entry.out as number;
        },
        "fiber/seq": async function* (entry) {
          let last: unknown;
          for (let i = 0; i < entry.children.length; i++) {
            last = yield i;
          }
          return last;
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 1 },
        b: { kind: "num/literal", children: [], out: 2 },
        c: { kind: "num/literal", children: [], out: 3 },
        s: { kind: "fiber/seq", children: ["a", "b", "c"], out: undefined },
      };
      count = 0;
      await fold<number>("s", adj, countingSeqInterp);
      expect(count).toBe(3);
    });

    test("seq with single child returns that child", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 99 },
        s: { kind: "fiber/seq", children: ["a"], out: undefined },
      };
      const result = await fold<number>("s", adj, seqInterp);
      expect(result).toBe(99);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TIMEOUT PATTERN: fiber/timeout tries body, falls back on error
  // ═══════════════════════════════════════════════════════════════════
  describe("timeout pattern (fiber/timeout)", () => {
    test("timeout with successful body returns body result", async () => {
      const timeoutInterp: Interpreter = {
        ...numInterp,
        "fiber/timeout": async function* (entry) {
          // child 0 = body, child 1 = fallback
          const body = yield 0;
          return body;
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "num/literal", children: [], out: 0 },
        t: { kind: "fiber/timeout", children: ["a", "b"], out: undefined },
      };
      const result = await fold<number>("t", adj, timeoutInterp);
      expect(result).toBe(42);
    });

    test("timeout with flag-based failure returns fallback", async () => {
      const timeoutInterp: Interpreter = {
        ...numInterp,
        "fiber/failing": async function* () {
          throw new Error("simulated timeout");
        },
        "fiber/timeout": async function* (entry) {
          // Use out as a flag: if truthy, skip body and use fallback
          const shouldFail = entry.out as boolean;
          if (shouldFail) {
            return yield 1; // fallback
          }
          return yield 0; // body
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "num/literal", children: [], out: -1 },
        t: {
          kind: "fiber/timeout",
          children: ["a", "b"],
          out: true, // flag: simulate failure
        },
      };
      const result = await fold<number>("t", adj, timeoutInterp);
      expect(result).toBe(-1);
    });

    test("timeout flag false returns body", async () => {
      const timeoutInterp: Interpreter = {
        ...numInterp,
        "fiber/timeout": async function* (entry) {
          const shouldFail = entry.out as boolean;
          if (shouldFail) return yield 1;
          return yield 0;
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 100 },
        b: { kind: "num/literal", children: [], out: -1 },
        t: {
          kind: "fiber/timeout",
          children: ["a", "b"],
          out: false,
        },
      };
      const result = await fold<number>("t", adj, timeoutInterp);
      expect(result).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MEMOIZATION ACROSS PAR CHILDREN: shared nodes evaluated once
  // ═══════════════════════════════════════════════════════════════════
  describe("memoization across par children", () => {
    test("shared node referenced by two par children evaluated once", async () => {
      let evalCount = 0;
      const countingParInterp: Interpreter = {
        "num/literal": async function* (entry) {
          evalCount++;
          return entry.out as number;
        },
        "num/add": async function* () {
          return ((yield 0) as number) + ((yield 1) as number);
        },
        "fiber/par": async function* (entry) {
          const results: unknown[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            results.push(yield i);
          }
          return results;
        },
      };
      // shared = 5, par children both reference add(shared, shared)
      const adj: Record<string, RuntimeEntry> = {
        s: { kind: "num/literal", children: [], out: 5 },
        x: { kind: "num/add", children: ["s", "s"], out: undefined },
        p: { kind: "fiber/par", children: ["x", "x"], out: undefined },
      };
      evalCount = 0;
      const result = await fold<number[]>("p", adj, countingParInterp);
      expect(result).toEqual([10, 10]);
      expect(evalCount).toBe(1); // literal "s" evaluated once
    });

    test("diamond in parallel branches: shared subexpr evaluated once", async () => {
      let litEvals = 0;
      const countingParInterp: Interpreter = {
        "num/literal": async function* (entry) {
          litEvals++;
          return entry.out as number;
        },
        "num/add": async function* () {
          return ((yield 0) as number) + ((yield 1) as number);
        },
        "num/mul": async function* () {
          return ((yield 0) as number) * ((yield 1) as number);
        },
        "fiber/par": async function* (entry) {
          const results: unknown[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            results.push(yield i);
          }
          return results;
        },
      };
      // Diamond: a=3, b=add(a,a)=6, c=mul(a,a)=9, par(b,c)=[6,9]
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/add", children: ["a", "a"], out: undefined },
        c: { kind: "num/mul", children: ["a", "a"], out: undefined },
        p: { kind: "fiber/par", children: ["b", "c"], out: undefined },
      };
      litEvals = 0;
      const result = await fold<number[]>("p", adj, countingParInterp);
      expect(result).toEqual([6, 9]);
      expect(litEvals).toBe(1);
    });

    test("three par children sharing a common leaf", async () => {
      let leafEvals = 0;
      const interp: Interpreter = {
        "num/literal": async function* (entry) {
          leafEvals++;
          return entry.out as number;
        },
        "num/add": async function* () {
          return ((yield 0) as number) + ((yield 1) as number);
        },
        "fiber/par": async function* (entry) {
          const results: unknown[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            results.push(yield i);
          }
          return results;
        },
      };
      // leaf=7, x=add(leaf,leaf)=14, y=add(leaf,leaf)=14 (same node as x!)
      // par(x, x, leaf) = [14, 14, 7]
      const adj: Record<string, RuntimeEntry> = {
        leaf: { kind: "num/literal", children: [], out: 7 },
        x: { kind: "num/add", children: ["leaf", "leaf"], out: undefined },
        p: { kind: "fiber/par", children: ["x", "x", "leaf"], out: undefined },
      };
      leafEvals = 0;
      const result = await fold<unknown[]>("p", adj, interp);
      expect(result).toEqual([14, 14, 7]);
      expect(leafEvals).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INDEPENDENT FOLD CALLS: fold() callable from within a handler
  // ═══════════════════════════════════════════════════════════════════
  describe("independent fold calls", () => {
    test("independent fold from within handler returns correct result", async () => {
      const subInterp: Interpreter = {
        ...numInterp,
        "fiber/subfold": async function* () {
          const subAdj: Record<string, RuntimeEntry> = {
            x: { kind: "num/literal", children: [], out: 42 },
          };
          const subResult = await fold<number>("x", subAdj, numInterp);
          return subResult;
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        r: { kind: "fiber/subfold", children: [], out: undefined },
      };
      const result = await fold<number>("r", adj, subInterp);
      expect(result).toBe(42);
    });

    test("independent fold does not interfere with parent fold", async () => {
      const subInterp: Interpreter = {
        ...numInterp,
        "fiber/subfold": async function* () {
          // Independent fold computes add(10, 20) = 30
          const subAdj: Record<string, RuntimeEntry> = {
            a: { kind: "num/literal", children: [], out: 10 },
            b: { kind: "num/literal", children: [], out: 20 },
            c: { kind: "num/add", children: ["a", "b"], out: undefined },
          };
          const inner = await fold<number>("c", subAdj, numInterp);
          return inner;
        },
        "num/add": async function* () {
          return ((yield 0) as number) + ((yield 1) as number);
        },
      };
      // Parent: add(subfold(), 5) where subfold() = 30 → 35
      const adj: Record<string, RuntimeEntry> = {
        s: { kind: "fiber/subfold", children: [], out: undefined },
        n: { kind: "num/literal", children: [], out: 5 },
        r: { kind: "num/add", children: ["s", "n"], out: undefined },
      };
      const result = await fold<number>("r", adj, subInterp);
      expect(result).toBe(35);
    });
  });
});
