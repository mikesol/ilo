import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodStringBoolBuilder, ZodTemplateLiteralBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("template literal and stringbool builders (#119, #156)", () => {
  it("$.zod.templateLiteral([...]) produces zod/template_literal AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(3);
    expect(ast.result.schema.parts[0]).toBe("hello, ");
    expect(ast.result.schema.parts[1].kind).toBe("zod/string");
    expect(ast.result.schema.parts[2]).toBe("!");
  });

  it("$.zod.templateLiteral() returns ZodTemplateLiteralBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      expect($.zod.templateLiteral(["hello, ", $.zod.string()])).toBeInstanceOf(
        ZodTemplateLiteralBuilder,
      );
      return $.zod.templateLiteral(["hello, ", $.zod.string()]).parse($.input);
    });
  });

  it("$.zod.templateLiteral() with number and enum parts", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(2);
    expect(ast.result.schema.parts[0].kind).toBe("zod/number");
    expect(ast.result.schema.parts[1].kind).toBe("zod/enum");
  });

  it("$.zod.stringbool() produces zod/stringbool AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
  });

  it("$.zod.stringbool() returns ZodStringBoolBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      expect($.zod.stringbool()).toBeInstanceOf(ZodStringBoolBuilder);
      return $.zod.stringbool().parse($.input);
    });
  });

  it("$.zod.stringbool() with custom truthy/falsy values", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .stringbool({
          truthy: ["yes", "y"],
          falsy: ["no", "n"],
          caseSensitive: true,
        })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.truthy).toEqual(["yes", "y"]);
    expect(ast.result.schema.falsy).toEqual(["no", "n"]);
    expect(ast.result.schema.caseSensitive).toBe(true);
  });

  it("$.zod.stringbool() with only truthy option", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool({ truthy: ["enabled"] }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.truthy).toEqual(["enabled"]);
    expect(ast.result.schema.falsy).toBeUndefined();
  });
});
