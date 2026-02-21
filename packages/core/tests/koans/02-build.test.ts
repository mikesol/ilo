import { test } from "vitest";

test("koan 02-build fixture executes", async () => {
  await import("../../src/__koans__/02-build");
});
