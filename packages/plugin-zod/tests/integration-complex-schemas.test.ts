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

describe("zodInterpreter: complex nested schemas (#121)", () => {
  it("object with array of unions", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          items: $.zod.array(
            $.zod.union([
              $.zod.object({ type: $.zod.literal("text"), content: $.zod.string() }),
              $.zod.object({ type: $.zod.literal("number"), value: $.zod.number() }),
            ]),
          ),
        })
        .parse($.input.value),
    );

    const validInput = {
      items: [
        { type: "text", content: "hello" },
        { type: "number", value: 42 },
      ],
    };

    const result = await run(prog, { value: validInput });
    expect(result).toEqual(validInput);
  });

  it("array of objects with nested tuples", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.object({
            id: $.zod.number(),
            coords: $.zod.tuple([$.zod.number(), $.zod.number()]),
            tags: $.zod.array($.zod.string()),
          }),
        )
        .parse($.input.value),
    );

    const validInput = [
      { id: 1, coords: [10, 20], tags: ["a", "b"] },
      { id: 2, coords: [30, 40], tags: ["c"] },
    ];

    const result = await run(prog, { value: validInput });
    expect(result).toEqual(validInput);
  });

  it("deep nesting with multiple schema types", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          user: $.zod.object({
            name: $.zod.string().min(1),
            age: $.zod.number().int().positive(),
            email: $.zod.email(),
          }),
          posts: $.zod.array(
            $.zod.object({
              title: $.zod.string(),
              tags: $.zod.array($.zod.string()),
              metadata: $.zod.record($.zod.string(), $.zod.unknown()),
            }),
          ),
          settings: $.zod
            .object({
              theme: $.zod.enum(["light", "dark"]),
              notifications: $.zod.boolean(),
            })
            .optional(),
        })
        .parse($.input.value),
    );

    const validInput = {
      user: {
        name: "Alice",
        age: 30,
        email: "alice@example.com",
      },
      posts: [
        {
          title: "First Post",
          tags: ["tech", "news"],
          metadata: { views: 100, likes: 50 },
        },
      ],
      settings: {
        theme: "dark",
        notifications: true,
      },
    };

    const result = await run(prog, { value: validInput });
    expect(result).toEqual(validInput);
  });

  it("union of complex types", async () => {
    const prog = app(($) =>
      $.zod
        .union([
          $.zod.object({
            type: $.zod.literal("user"),
            data: $.zod.object({
              name: $.zod.string(),
              roles: $.zod.array($.zod.string()),
            }),
          }),
          $.zod.object({
            type: $.zod.literal("system"),
            data: $.zod.object({
              code: $.zod.number(),
              message: $.zod.string(),
            }),
          }),
        ])
        .parse($.input.value),
    );

    const userInput = {
      type: "user",
      data: { name: "Bob", roles: ["admin", "editor"] },
    };

    const result = await run(prog, { value: userInput });
    expect(result).toEqual(userInput);
  });

  it("intersection with nested objects", async () => {
    const prog = app(($) =>
      $.zod
        .intersection(
          $.zod.object({
            id: $.zod.number(),
            timestamps: $.zod.object({
              created: $.zod.date(),
            }),
          }),
          $.zod.object({
            name: $.zod.string(),
            timestamps: $.zod.object({
              updated: $.zod.date(),
            }),
          }),
        )
        .safeParse($.input.value),
    );

    const now = new Date();
    const validInput = {
      id: 1,
      name: "Test",
      timestamps: { created: now, updated: now },
    };

    const result = (await run(prog, { value: validInput })) as any;
    expect(result.success).toBe(true);
  });

  it("map with object values", async () => {
    const prog = app(($) =>
      $.zod
        .map(
          $.zod.string(),
          $.zod.object({
            value: $.zod.number(),
            metadata: $.zod.record($.zod.string(), $.zod.string()),
          }),
        )
        .parse($.input.value),
    );

    const validInput = new Map([
      ["key1", { value: 100, metadata: { a: "1", b: "2" } }],
      ["key2", { value: 200, metadata: { c: "3" } }],
    ]);

    const result = await run(prog, { value: validInput });
    expect(result).toEqual(validInput);
  });

  it("record with array values", async () => {
    const prog = app(($) =>
      $.zod
        .record(
          $.zod.string(),
          $.zod.array(
            $.zod.object({
              id: $.zod.number(),
              active: $.zod.boolean(),
            }),
          ),
        )
        .parse($.input.value),
    );

    const validInput = {
      group1: [
        { id: 1, active: true },
        { id: 2, active: false },
      ],
      group2: [{ id: 3, active: true }],
    };

    const result = await run(prog, { value: validInput });
    expect(result).toEqual(validInput);
  });
});
