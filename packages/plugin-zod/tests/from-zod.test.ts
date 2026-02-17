import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("fromZod: basic types (#122)", () => {
  const app = mvfm(zod);

  it("converts z.string() to zod/string node", () => {
    const prog = app(($) => $.zod.fromZod(z.string()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.schema.checks).toEqual([]);
  });

  it("converts z.string().min(5) with checks", () => {
    const prog = app(($) => $.zod.fromZod(z.string().min(5)).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.schema.checks).toContainEqual({ kind: "min_length", value: 5 });
  });

  it("converts z.number() to zod/number node", () => {
    const prog = app(($) => $.zod.fromZod(z.number()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/number");
  });

  it("converts z.number().min(0).max(100) with checks", () => {
    const prog = app(($) => $.zod.fromZod(z.number().min(0).max(100)).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/number");
    expect(ast.result.schema.checks.length).toBeGreaterThanOrEqual(2);
  });

  it("converts z.boolean() to zod/boolean node", () => {
    const prog = app(($) => $.zod.fromZod(z.boolean()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/boolean");
  });

  it("converts z.date() to zod/date node", () => {
    const prog = app(($) => $.zod.fromZod(z.date()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/date");
  });

  it("converts z.bigint() to zod/bigint node", () => {
    const prog = app(($) => $.zod.fromZod(z.bigint()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/bigint");
  });

  it("converts z.literal('hello') to zod/literal node", () => {
    const prog = app(($) => $.zod.fromZod(z.literal("hello")).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/literal");
    expect(ast.result.schema.value).toBe("hello");
  });

  it("converts z.enum(['a', 'b']) to zod/enum node", () => {
    const prog = app(($) => $.zod.fromZod(z.enum(["a", "b", "c"])).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/enum");
    expect(ast.result.schema.values).toEqual(["a", "b", "c"]);
  });
});

describe("fromZod: container types (#122)", () => {
  const app = mvfm(zod);

  it("converts z.object({ name: z.string(), age: z.number() })", () => {
    const prog = app(($) =>
      $.zod
        .fromZod(
          z.object({
            name: z.string(),
            age: z.number(),
          }),
        )
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.age.kind).toBe("zod/number");
  });

  it("converts z.array(z.string())", () => {
    const prog = app(($) => $.zod.fromZod(z.array(z.string())).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/array");
    expect(ast.result.schema.element.kind).toBe("zod/string");
  });

  it("converts z.array(z.number()).min(3)", () => {
    const prog = app(($) => $.zod.fromZod(z.array(z.number()).min(3)).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/array");
    expect(ast.result.schema.checks).toContainEqual({ kind: "min_length", value: 3 });
  });

  it("converts z.tuple([z.string(), z.number()])", () => {
    const prog = app(($) => $.zod.fromZod(z.tuple([z.string(), z.number()])).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/tuple");
    expect(ast.result.schema.items.length).toBe(2);
    expect(ast.result.schema.items[0].kind).toBe("zod/string");
    expect(ast.result.schema.items[1].kind).toBe("zod/number");
  });

  it("converts z.record(z.string(), z.number())", () => {
    const prog = app(($) => $.zod.fromZod(z.record(z.string(), z.number())).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/record");
    expect(ast.result.schema.keyType.kind).toBe("zod/string");
    expect(ast.result.schema.valueType.kind).toBe("zod/number");
  });

  it("converts z.union([z.string(), z.number()])", () => {
    const prog = app(($) => $.zod.fromZod(z.union([z.string(), z.number()])).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/union");
    expect(ast.result.schema.options.length).toBe(2);
    expect(ast.result.schema.options[0].kind).toBe("zod/string");
    expect(ast.result.schema.options[1].kind).toBe("zod/number");
  });
});

describe("fromZod: wrapper types (#122)", () => {
  const app = mvfm(zod);

  it("converts z.string().optional()", () => {
    const prog = app(($) => $.zod.fromZod(z.string().optional()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("converts z.string().nullable()", () => {
    const prog = app(($) => $.zod.fromZod(z.string().nullable()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nullable");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("converts z.string().default('hello')", () => {
    const prog = app(($) => $.zod.fromZod(z.string().default("hello")).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/default");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.value.kind).toBe("core/literal");
    expect(ast.result.schema.value.value).toBe("hello");
  });
});

describe("fromZod: error handling (#122)", () => {
  const app = mvfm(zod);

  it("throws error for z.string().transform()", () => {
    expect(() => {
      app(($) => $.zod.fromZod(z.string().transform((x) => x.toUpperCase())).parse($.input));
    }).toThrow(/transforms with functions.*cannot be converted/);
  });

  it("throws error for z.string().refine()", () => {
    expect(() => {
      app(($) => $.zod.fromZod(z.string().refine((x) => x.length > 5)).parse($.input));
    }).toThrow(/refinements with custom functions.*cannot be converted/);
  });
});

describe("fromZod: nested schemas (#122)", () => {
  const app = mvfm(zod);

  it("converts nested object with arrays", () => {
    const prog = app(($) =>
      $.zod
        .fromZod(
          z.object({
            users: z.array(
              z.object({
                name: z.string(),
                age: z.number(),
              }),
            ),
          }),
        )
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    expect(ast.result.schema.shape.users.kind).toBe("zod/array");
    expect(ast.result.schema.shape.users.element.kind).toBe("zod/object");
    expect(ast.result.schema.shape.users.element.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.users.element.shape.age.kind).toBe("zod/number");
  });

  it("converts optional fields in object", () => {
    const prog = app(($) =>
      $.zod
        .fromZod(
          z.object({
            name: z.string(),
            nickname: z.string().optional(),
          }),
        )
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.nickname.kind).toBe("zod/optional");
    expect(ast.result.schema.shape.nickname.inner.kind).toBe("zod/string");
  });
});
