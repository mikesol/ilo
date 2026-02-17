import { coreInterpreter, foldAST, injectInput, mvfm, type Program } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
}

const app = mvfm(zod);

describe("zodInterpreter: template_literal and stringbool (#156)", () => {
  describe("templateLiteral", () => {
    it("validates strings matching template pattern", async () => {
      const prog = app(($) =>
        $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input.value),
      );
      expect(await run(prog, { value: "hello, world!" })).toBe("hello, world!");
      expect(await run(prog, { value: "hello, Alice!" })).toBe("hello, Alice!");
    });

    it("rejects strings not matching template pattern", async () => {
      const prog = app(($) =>
        $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).safeParse($.input.value),
      );
      const result = (await run(prog, { value: "goodbye" })) as any;
      expect(result.success).toBe(false);
    });

    it("validates template with number and enum", async () => {
      const prog = app(($) =>
        $.zod
          .templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])])
          .parse($.input.value),
      );
      expect(await run(prog, { value: "16px" })).toBe("16px");
      expect(await run(prog, { value: "2em" })).toBe("2em");
      expect(await run(prog, { value: "1.5rem" })).toBe("1.5rem");
    });

    it("rejects invalid template with number and enum", async () => {
      const prog = app(($) =>
        $.zod
          .templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])])
          .safeParse($.input.value),
      );
      const result = (await run(prog, { value: "16pt" })) as any;
      expect(result.success).toBe(false);
    });

    it("works with only static parts", async () => {
      const prog = app(($) => $.zod.templateLiteral(["hello"]).parse($.input.value));
      expect(await run(prog, { value: "hello" })).toBe("hello");
    });

    it("works with complex nested schemas", async () => {
      const prog = app(($) =>
        $.zod
          .templateLiteral(["User: ", $.zod.string(), ", Age: ", $.zod.number()])
          .parse($.input.value),
      );
      expect(await run(prog, { value: "User: Alice, Age: 30" })).toBe("User: Alice, Age: 30");
    });
  });

  describe("stringbool", () => {
    it("converts default truthy values to true", async () => {
      const prog = app(($) => $.zod.stringbool().parse($.input.value));
      expect(await run(prog, { value: "true" })).toBe(true);
      expect(await run(prog, { value: "1" })).toBe(true);
      expect(await run(prog, { value: "yes" })).toBe(true);
      expect(await run(prog, { value: "on" })).toBe(true);
      expect(await run(prog, { value: "y" })).toBe(true);
      expect(await run(prog, { value: "enabled" })).toBe(true);
    });

    it("converts default falsy values to false", async () => {
      const prog = app(($) => $.zod.stringbool().parse($.input.value));
      expect(await run(prog, { value: "false" })).toBe(false);
      expect(await run(prog, { value: "0" })).toBe(false);
      expect(await run(prog, { value: "no" })).toBe(false);
      expect(await run(prog, { value: "off" })).toBe(false);
      expect(await run(prog, { value: "n" })).toBe(false);
      expect(await run(prog, { value: "disabled" })).toBe(false);
    });

    it("rejects invalid values", async () => {
      const prog = app(($) => $.zod.stringbool().safeParse($.input.value));
      const result = (await run(prog, { value: "invalid" })) as any;
      expect(result.success).toBe(false);
    });

    it("works with custom truthy/falsy values", async () => {
      const prog = app(($) =>
        $.zod
          .stringbool({
            truthy: ["yes", "y"],
            falsy: ["no", "n"],
            caseSensitive: true,
          })
          .parse($.input.value),
      );
      expect(await run(prog, { value: "yes" })).toBe(true);
      expect(await run(prog, { value: "y" })).toBe(true);
      expect(await run(prog, { value: "no" })).toBe(false);
      expect(await run(prog, { value: "n" })).toBe(false);
    });

    it("respects case sensitivity", async () => {
      const prog = app(($) =>
        $.zod
          .stringbool({
            truthy: ["YES"],
            falsy: ["NO"],
            caseSensitive: true,
          })
          .safeParse($.input.value),
      );
      const upperValid = (await run(prog, { value: "YES" })) as any;
      expect(upperValid.success).toBe(true);
      expect(upperValid.data).toBe(true);

      const lowerInvalid = (await run(prog, { value: "yes" })) as any;
      expect(lowerInvalid.success).toBe(false);
    });

    it("works with optional wrapper", async () => {
      const prog = app(($) => $.zod.stringbool().optional().safeParse($.input.value));
      const undef = (await run(prog, { value: undefined })) as any;
      expect(undef.success).toBe(true);
      const valid = (await run(prog, { value: "true" })) as any;
      expect(valid.success).toBe(true);
      expect(valid.data).toBe(true);
    });
  });
});
