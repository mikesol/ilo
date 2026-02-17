import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodLazyBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("lazy schemas (#117)", () => {
  it("$.zod.lazy() returns a ZodLazyBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.lazy(() => $.zod.string());
      expect(builder).toBeInstanceOf(ZodLazyBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.lazy() produces zod/lazy AST with getter function", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.lazy(() => $.zod.string()).parse($.input);
    });
    const ast = prog.ast as any;
    expect(ast.result.schema.kind).toBe("zod/lazy");
    // The getter function is stored in the AST but won't survive JSON serialization
    expect(ast.result.schema.getter).toBeDefined();
    expect(typeof ast.result.schema.getter).toBe("function");
  });

  it("self-referential schema produces finite AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input);
    });

    // Verify the AST is finite (doesn't have infinite nesting)
    const ast = prog.ast as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    const shape = ast.result.schema.shape;
    expect(shape.name.kind).toBe("zod/string");
    expect(shape.subcategories.kind).toBe("zod/lazy");
    // The lazy node should have a getter, not a fully expanded schema
    expect(typeof shape.subcategories.getter).toBe("function");
  });

  it("mutual recursion produces finite AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const User = $.zod.object({
        email: $.zod.string(),
        posts: $.zod.lazy(() => $.zod.array(Post)),
      });
      const Post = $.zod.object({
        title: $.zod.string(),
        author: $.zod.lazy(() => User),
      });
      return User.parse($.input);
    });

    // Verify both schemas produce finite ASTs
    const ast = prog.ast as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    const userShape = ast.result.schema.shape;
    expect(userShape.email.kind).toBe("zod/string");
    expect(userShape.posts.kind).toBe("zod/lazy");
    expect(typeof userShape.posts.getter).toBe("function");
  });

  it("lazy schema can be called multiple times", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const getter = () => $.zod.string();
      const lazy1 = $.zod.lazy(getter);
      const _lazy2 = $.zod.lazy(getter);
      // Return just the first one - we're testing AST structure
      return lazy1.parse($.input.a);
    });

    const ast = prog.ast as any;
    // The lazy schema should exist in the AST
    expect(ast.result.schema.kind).toBe("zod/lazy");
  });

  it("lazy schema inherits base methods (optional, nullable)", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .lazy(() => $.zod.string())
        .optional()
        .parse($.input);
    });

    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/lazy");
  });
});
