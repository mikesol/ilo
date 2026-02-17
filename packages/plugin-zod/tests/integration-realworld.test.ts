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

describe("zodInterpreter: real-world examples (#121)", () => {
  it("API request schema with validation", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          method: $.zod.enum(["GET", "POST", "PUT", "DELETE"]),
          url: $.zod.url(),
          headers: $.zod.record($.zod.string(), $.zod.string()).optional(),
          body: $.zod.union([$.zod.object({}).catchall($.zod.unknown()), $.zod.null()]).optional(),
          timeout: $.zod.number().int().positive().default(30000),
        })
        .parse($.input.value),
    );

    const validInput = {
      method: "POST",
      url: "https://api.example.com/users",
      headers: { "Content-Type": "application/json" },
      body: { name: "Test User" },
    };

    const result = await run(prog, { value: validInput });
    expect(result.method).toBe("POST");
    expect(result.timeout).toBe(30000);
  });

  it("database record schema with transformations", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          id: $.zod.uuid(),
          email: $.zod.email().toLowerCase(),
          username: $.zod.string().min(3).max(20).trim(),
          age: $.zod.number().int().gte(0).lte(120),
          tags: $.zod.set($.zod.string()),
          metadata: $.zod.record($.zod.string(), $.zod.unknown()).optional(),
          created_at: $.zod.date(),
        })
        .parse($.input.value),
    );

    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const now = new Date();
    const validInput = {
      id: uuid,
      email: "USER@EXAMPLE.COM",
      username: "  testuser  ",
      age: 25,
      tags: new Set(["user", "active"]),
      created_at: now,
    };

    const result = await run(prog, { value: validInput });
    expect(result.email).toBe("user@example.com");
    expect(result.username).toBe("testuser");
  });

  it("configuration schema with coercion", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          port: $.zod.coerce.number().int().positive(),
          host: $.zod.string().default("localhost"),
          maxConnections: $.zod.coerce.number().int().positive().default(100),
          allowedOrigins: $.zod.array($.zod.url()),
        })
        .parse($.input.value),
    );

    const validInput = {
      port: "3000",
      allowedOrigins: ["https://example.com"],
    };

    const result = await run(prog, { value: validInput });
    expect(result.port).toBe(3000);
    expect(result.host).toBe("localhost");
  });

  it("event schema with discriminated union", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.union([
            $.zod.object({
              type: $.zod.literal("click"),
              timestamp: $.zod.date(),
              element: $.zod.string(),
              coords: $.zod.tuple([$.zod.number(), $.zod.number()]),
            }),
            $.zod.object({
              type: $.zod.literal("input"),
              timestamp: $.zod.date(),
              field: $.zod.string(),
              value: $.zod.string(),
            }),
            $.zod.object({
              type: $.zod.literal("navigation"),
              timestamp: $.zod.date(),
              from: $.zod.url(),
              to: $.zod.url(),
            }),
          ]),
        )
        .parse($.input.value),
    );

    const now = new Date();
    const validInput = [
      { type: "click", timestamp: now, element: "button#submit", coords: [100, 200] },
      { type: "input", timestamp: now, field: "email", value: "test@example.com" },
      {
        type: "navigation",
        timestamp: now,
        from: "https://example.com/home",
        to: "https://example.com/about",
      },
    ];

    const result = await run(prog, { value: validInput });
    expect(result).toHaveLength(3);
  });
});

describe("zodInterpreter: edge cases and validation (#121)", () => {
  it("handles empty arrays and objects", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          items: $.zod.array($.zod.string()),
          metadata: $.zod.record($.zod.string(), $.zod.number()),
        })
        .parse($.input.value),
    );

    const result = await run(prog, { value: { items: [], metadata: {} } });
    expect(result).toEqual({ items: [], metadata: {} });
  });

  it("handles nullable and optional fields", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          required: $.zod.string(),
          optional: $.zod.string().optional(),
          nullable: $.zod.number().nullable(),
          nullish: $.zod.boolean().nullish(),
        })
        .safeParse($.input.value),
    );

    const result = (await run(prog, {
      value: { required: "test", nullable: null, nullish: undefined },
    })) as any;
    expect(result.success).toBe(true);
  });

  it("validates bigint values", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          id: $.zod.bigint(),
          amounts: $.zod.array($.zod.bigint().positive()),
        })
        .parse($.input.value),
    );

    const result = await run(prog, { value: { id: 123n, amounts: [100n, 200n] } });
    expect(result.id).toBe(123n);
    expect(result.amounts).toEqual([100n, 200n]);
  });

  it("validates literal types in complex structures", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          status: $.zod.literal("active"),
          // literal array creates union: "admin" | "user"
          type: $.zod.literal(["admin", "user"]),
          count: $.zod.literal(42),
        })
        .safeParse($.input.value),
    );

    const result = (await run(prog, {
      value: { status: "active", type: "admin", count: 42 },
    })) as any;
    expect(result.success).toBe(true);
  });

  it("handles branded types", async () => {
    const prog = app(($) => $.zod.string().brand("UserId").parse($.input.value));

    const result = await run(prog, { value: "user-123" });
    expect(result).toBe("user-123");
  });

  it("handles catch with default value", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          count: $.zod.number().catch(0),
        })
        .safeParse($.input.value),
    );

    const result = (await run(prog, { value: { count: "invalid" } })) as any;
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(0);
  });

  it("handles readonly wrappers", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          items: $.zod.array($.zod.string()).readonly(),
        })
        .parse($.input.value),
    );

    const result = await run(prog, { value: { items: ["a", "b", "c"] } });
    expect(result.items).toEqual(["a", "b", "c"]);
  });

  it("rejects invalid nested data", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          user: $.zod.object({
            email: $.zod.email(),
            age: $.zod.number().int().positive(),
          }),
        })
        .safeParse($.input.value),
    );

    const result = (await run(prog, {
      value: { user: { email: "not-an-email", age: -5 } },
    })) as any;
    expect(result.success).toBe(false);
  });

  it("rejects wrong union variant", async () => {
    const prog = app(($) =>
      $.zod
        .union([
          $.zod.object({ type: $.zod.literal("a"), value: $.zod.string() }),
          $.zod.object({ type: $.zod.literal("b"), value: $.zod.number() }),
        ])
        .safeParse($.input.value),
    );

    const result = (await run(prog, { value: { type: "c", value: "test" } })) as any;
    expect(result.success).toBe(false);
  });

  it("rejects invalid array element type", async () => {
    const prog = app(($) =>
      $.zod
        .array(
          $.zod.object({
            id: $.zod.number(),
            name: $.zod.string(),
          }),
        )
        .safeParse($.input.value),
    );

    const result = (await run(prog, {
      value: [
        { id: 1, name: "valid" },
        { id: "invalid", name: "test" },
      ],
    })) as any;
    expect(result.success).toBe(false);
  });
});
