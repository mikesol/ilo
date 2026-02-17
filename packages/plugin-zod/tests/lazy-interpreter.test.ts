import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  type Program,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
}

const app = mvfm(zod);

describe("zodInterpreter: lazy schemas (#154)", () => {
  it("parse() accepts valid simple lazy schema", async () => {
    const prog = app(($) => {
      const schema = $.zod.lazy(() => $.zod.string());
      return schema.parse($.input.value);
    });
    expect(await run(prog, { value: "hello" })).toBe("hello");
  });

  it("parse() rejects invalid simple lazy schema", async () => {
    const prog = app(($) => {
      const schema = $.zod.lazy(() => $.zod.string());
      return schema.parse($.input.value);
    });
    await expect(run(prog, { value: 42 })).rejects.toThrow();
  });

  it("safeParse() returns success for valid lazy schema", async () => {
    const prog = app(($) => {
      const schema = $.zod.lazy(() => $.zod.string());
      return schema.safeParse($.input.value);
    });
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it("safeParse() returns failure for invalid lazy schema", async () => {
    const prog = app(($) => {
      const schema = $.zod.lazy(() => $.zod.string());
      return schema.safeParse($.input.value);
    });
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });

  it("recursive schema: category with subcategories", async () => {
    const prog = app(($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.safeParse($.input.value);
    });
    
    const validData = {
      name: "Electronics",
      subcategories: [
        {
          name: "Computers",
          subcategories: [
            { name: "Laptops", subcategories: [] },
            { name: "Desktops", subcategories: [] },
          ],
        },
        {
          name: "Phones",
          subcategories: [],
        },
      ],
    };
    
    const result = (await run(prog, { value: validData })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  it("recursive schema: rejects invalid nested data", async () => {
    const prog = app(($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.safeParse($.input.value);
    });
    
    const invalidData = {
      name: "Electronics",
      subcategories: [
        {
          name: "Computers",
          subcategories: [
            { name: 123, subcategories: [] }, // Invalid: name should be string
          ],
        },
      ],
    };
    
    const result = (await run(prog, { value: invalidData })) as any;
    expect(result.success).toBe(false);
  });

  it("mutually recursive schemas: User and Post", async () => {
    const prog = app(($) => {
      const User = $.zod.object({
        email: $.zod.string(),
        posts: $.zod.lazy(() => $.zod.array(Post)),
      });
      const Post = $.zod.object({
        title: $.zod.string(),
        author: $.zod.lazy(() => User),
      });
      return User.safeParse($.input.value);
    });
    
    const validData = {
      email: "user@example.com",
      posts: [
        {
          title: "First Post",
          author: {
            email: "user@example.com",
            posts: [],
          },
        },
      ],
    };
    
    const result = (await run(prog, { value: validData })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  it("lazy with optional wrapper allows undefined", async () => {
    const prog = app(($) => {
      const schema = $.zod.lazy(() => $.zod.string()).optional();
      return schema.safeParse($.input.value);
    });
    const undefResult = (await run(prog, { value: undefined })) as any;
    const validResult = (await run(prog, { value: "hello" })) as any;
    const invalidResult = (await run(prog, { value: 42 })) as any;
    
    expect(undefResult.success).toBe(true);
    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });
});
