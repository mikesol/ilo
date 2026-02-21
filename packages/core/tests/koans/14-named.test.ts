import { test } from "vitest";

test("koan 14-named fixture executes", async () => {
  await import("../../src/__koans__/14-named");
});
