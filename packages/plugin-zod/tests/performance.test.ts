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

describe("zodInterpreter: performance sanity checks (#121)", () => {
  it("handles large arrays efficiently", async () => {
    const prog = app(($) => $.zod.array($.zod.number()).parse($.input.value));

    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    const start = Date.now();
    const result = await run(prog, { value: largeArray });
    const duration = Date.now() - start;

    expect(result).toHaveLength(10000);
    // Should complete in less than 1 second
    expect(duration).toBeLessThan(1000);
  });

  it("handles deeply nested objects efficiently", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          level1: $.zod.object({
            level2: $.zod.object({
              level3: $.zod.object({
                level4: $.zod.object({
                  value: $.zod.string(),
                }),
              }),
            }),
          }),
        })
        .parse($.input.value),
    );

    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: "deep",
            },
          },
        },
      },
    };

    const start = Date.now();
    const result = await run(prog, { value: deepObject });
    const duration = Date.now() - start;

    expect(result.level1.level2.level3.level4.value).toBe("deep");
    // Should complete in less than 100ms
    expect(duration).toBeLessThan(100);
  });

  it("handles large objects with many fields", async () => {
    const prog = app(($) => {
      // Create a schema with 100 fields
      const shape: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        shape[`field${i}`] = i % 2 === 0 ? $.zod.string() : $.zod.number();
      }
      return $.zod.object(shape).parse($.input.value);
    });

    const largeObject: Record<string, string | number> = {};
    for (let i = 0; i < 100; i++) {
      largeObject[`field${i}`] = i % 2 === 0 ? `value${i}` : i;
    }

    const start = Date.now();
    const result = await run(prog, { value: largeObject });
    const duration = Date.now() - start;

    expect(Object.keys(result).length).toBe(100);
    // Should complete in less than 500ms
    expect(duration).toBeLessThan(500);
  });

  it("handles complex nested structures efficiently", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.object({
            id: $.zod.number(),
            items: $.zod.array(
              $.zod.object({
                name: $.zod.string(),
                tags: $.zod.array($.zod.string()),
              }),
            ),
          }),
        )
        .parse($.input.value),
    );

    const complexData = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      items: Array.from({ length: 10 }, (_, j) => ({
        name: `item-${j}`,
        tags: [`tag1`, `tag2`, `tag3`],
      })),
    }));

    const start = Date.now();
    const result = await run(prog, { value: complexData });
    const duration = Date.now() - start;

    expect(result).toHaveLength(100);
    expect(result[0].items).toHaveLength(10);
    // Should complete in less than 1 second
    expect(duration).toBeLessThan(1000);
  });

  it("handles validation errors efficiently", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.object({
            email: $.zod.email(),
            age: $.zod.number().int().positive(),
          }),
        )
        .safeParse($.input.value),
    );

    // Create data with errors in the middle
    const dataWithErrors = Array.from({ length: 100 }, (_, i) => ({
      email: i === 50 ? "invalid-email" : `user${i}@example.com`,
      age: i === 60 ? -1 : 25,
    }));

    const start = Date.now();
    const result = (await run(prog, { value: dataWithErrors })) as any;
    const duration = Date.now() - start;

    expect(result.success).toBe(false);
    // Error detection should be fast
    expect(duration).toBeLessThan(500);
  });

  it("handles union validation efficiently", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.union([
            $.zod.object({ type: $.zod.literal("a"), value: $.zod.string() }),
            $.zod.object({ type: $.zod.literal("b"), value: $.zod.number() }),
            $.zod.object({ type: $.zod.literal("c"), value: $.zod.boolean() }),
          ]),
        )
        .parse($.input.value),
    );

    const unionData = Array.from({ length: 300 }, (_, i) => {
      const type = ["a", "b", "c"][i % 3];
      return {
        type,
        value: type === "a" ? "string" : type === "b" ? 42 : true,
      };
    });

    const start = Date.now();
    const result = await run(prog, { value: unionData });
    const duration = Date.now() - start;

    expect(result).toHaveLength(300);
    // Should complete in less than 1 second
    expect(duration).toBeLessThan(1000);
  });
});
