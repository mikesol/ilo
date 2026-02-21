import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("fold propagates child errors to parent generator via gen.throw", async () => {
  const adj = {
    bad: { kind: "throw/child", children: [], out: undefined },
    root: { kind: "catch/parent", children: ["bad"], out: undefined },
  };

  const interp = {
    "throw/child": async function* () {
      yield* [];
      throw new Error("boom");
    },
    "catch/parent": async function* () {
      try {
        return (yield 0) as number;
      } catch {
        return "fallback";
      }
    },
  };

  await expect(koan.fold<string>("root", adj, interp)).resolves.toBe("fallback");
});
