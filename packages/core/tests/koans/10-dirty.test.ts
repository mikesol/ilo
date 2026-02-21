import { test } from "vitest";

test("koan 10-dirty fixture executes", async () => {
  await import("../../src/__koans__/10-dirty");
});
