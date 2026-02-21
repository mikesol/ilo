import { test } from "vitest";

test("koan 00-expr fixture executes", async () => {
  await import("../../src/__koans__/00-expr");
});
