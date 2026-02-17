import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { defaults } from "../../../src/defaults";
import type { TypedNode } from "../../../src/fold";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { control } from "../../../src/plugins/control";
import { controlInterpreter } from "../../../src/plugins/control/interpreter";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";
import { num } from "../../../src/plugins/num";
import { ord } from "../../../src/plugins/ord";
import { semiring } from "../../../src/plugins/semiring";
import { st } from "../../../src/plugins/st";

const combined = {
  ...coreInterpreter,
  ...controlInterpreter,
  ...errorInterpreter,
};

describe("control interpreter (low-level)", () => {
  it("provides defaultInterpreter so defaults(app) works without override", () => {
    const app = mvfm(control);
    expect(() => defaults(app)).not.toThrow();
  });

  it("evaluates each body for every collection item", async () => {
    const node: TypedNode = {
      kind: "control/each",
      collection: { kind: "core/literal", value: [1] },
      param: { kind: "core/lambda_param", name: "item", __id: 1 },
      body: [{ kind: "error/fail", error: { kind: "core/literal", value: "boom" } }],
    };

    await expect(foldAST(combined, node)).rejects.toBe("boom");
  });

  it("returns undefined for while when condition is false", async () => {
    const node: TypedNode = {
      kind: "control/while",
      condition: { kind: "core/literal", value: false },
      body: [{ kind: "error/fail", error: { kind: "core/literal", value: "boom" } }],
    };

    await expect(foldAST(combined, node)).resolves.toBeUndefined();
  });
});

describe("control: each end-to-end", () => {
  const app = mvfm(num, semiring, ord, st, control);

  it("iterates over input array and accumulates a count", async () => {
    const prog = app({ items: "string" }, ($) => {
      const count = $.let(0);
      $.each($.input.items as any, () => {
        count.set($.add(count.get(), 1));
      });
      return count.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { items: ["a", "b", "c"] }));
    expect(result).toBe(3);
  });

  it("iterates over a raw array of expressions (auto-lift)", async () => {
    const prog = app({ a: "number", b: "number", c: "number" }, ($) => {
      const sum = $.let(0);
      $.each([$.input.a, $.input.b, $.input.c] as any, (item: any) => {
        sum.set($.add(sum.get(), item));
      });
      return sum.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { a: 10, b: 20, c: 30 }));
    expect(result).toBe(60);
  });

  it("provides item parameter to body callback", async () => {
    const prog = app({ items: "string" }, ($) => {
      const sum = $.let(0);
      $.each($.input.items as any, (item: any) => {
        sum.set($.add(sum.get(), item));
      });
      return sum.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { items: [10, 20, 30] }));
    expect(result).toBe(60);
  });

  it("handles empty collection", async () => {
    const prog = app({ items: "string" }, ($) => {
      const count = $.let(0);
      $.each($.input.items as any, () => {
        count.set($.add(count.get(), 1));
      });
      return count.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { items: [] }));
    expect(result).toBe(0);
  });
});

describe("control: while end-to-end", () => {
  const app = mvfm(num, semiring, ord, st, control);

  it("loops until condition becomes false", async () => {
    const prog = app({ limit: "number" }, ($) => {
      const i = $.let(0);
      $.while($.lt(i.get(), $.input.limit)).body(() => {
        i.set($.add(i.get(), 1));
      });
      return i.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { limit: 5 }));
    expect(result).toBe(5);
  });

  it("does not execute body when condition is initially false", async () => {
    const prog = app({ limit: "number" }, ($) => {
      const i = $.let(0);
      $.while($.lt(i.get(), $.input.limit)).body(() => {
        i.set($.add(i.get(), 1));
      });
      return i.get();
    });
    const result = await foldAST(defaults(app), injectInput(prog, { limit: 0 }));
    expect(result).toBe(0);
  });

  it("mutates multiple variables per iteration", async () => {
    const prog = app(($) => {
      const i = $.let(0);
      const sum = $.let(0);
      $.while($.lt(i.get(), 4)).body(() => {
        sum.set($.add(sum.get(), i.get()));
        i.set($.add(i.get(), 1));
      });
      return sum.get();
    });
    // sum = 0 + 1 + 2 + 3 = 6
    const result = await foldAST(defaults(app), prog);
    expect(result).toBe(6);
  });
});
