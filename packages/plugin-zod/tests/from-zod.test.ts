import { describe, expect, it, vi } from "vitest";
import { z as nativeZod } from "zod";
import { coreInterpreter, foldAST, injectInput, mvfm, type Program } from "../../core/src/index";
import { createZodInterpreter, zod } from "../src/index";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

async function run(prog: Program, input: unknown) {
  const interp = { ...coreInterpreter, ...createZodInterpreter() };
  return foldAST(interp, injectInput(prog, input));
}

describe("$.zod.from()", () => {
  it("converts nested object schemas into zod AST nodes", () => {
    const app = mvfm(zod);
    const source = nativeZod.object({
      name: nativeZod.string().min(2),
      age: nativeZod.number().int().optional(),
      tags: nativeZod.array(nativeZod.string()).max(3),
    });

    const prog = app(($) => $.zod.from(source).parse($.input));
    const ast = strip(prog.ast) as any;

    expect(ast.result.kind).toBe("zod/parse");
    expect(ast.result.schema.kind).toBe("zod/object");
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.name.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "min_length", value: 2 })]),
    );
    expect(ast.result.schema.shape.age.kind).toBe("zod/optional");
    expect(ast.result.schema.shape.age.inner.kind).toBe("zod/number");
    expect(ast.result.schema.shape.tags.kind).toBe("zod/array");
  });

  it("throws in strict mode when refinement closures are present", () => {
    const app = mvfm(zod);
    const source = nativeZod.string().refine((val) => val.length > 0, { message: "required" });

    expect(() => app(($) => $.zod.from(source).parse($.input))).toThrow(
      /refinement|closure|custom/i,
    );
  });

  it("drops refinements and warns in non-strict mode", () => {
    const app = mvfm(zod);
    const source = nativeZod.object({
      name: nativeZod.string().refine((val) => val.startsWith("a")),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const prog = app(($) => $.zod.from(source, { strict: false }).parse($.input));
    const ast = strip(prog.ast) as any;

    expect(ast.result.schema.shape.name.refinements).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("preserves parse behavior for supported schemas", async () => {
    const app = mvfm(zod);
    const source = nativeZod.object({
      name: nativeZod.string().min(2),
      age: nativeZod.number().gte(18),
    });
    const prog = app(($) => $.zod.from(source).safeParse($.input));

    const goodInput = { name: "jo", age: 21 };
    const badInput = { name: "j", age: 12 };

    const expectedGood = source.safeParse(goodInput);
    const expectedBad = source.safeParse(badInput);
    const actualGood = (await run(prog, goodInput)) as any;
    const actualBad = (await run(prog, badInput)) as any;

    expect(actualGood.success).toBe(expectedGood.success);
    expect(actualBad.success).toBe(expectedBad.success);
  });
});
