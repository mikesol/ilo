import { test } from "vitest";

test("koan 01-increment fixture executes", async () => {
  await import("../../src/__koans__/01-increment");
});
