import { test } from "vitest";

test("koan 09-gc fixture executes", async () => {
  await import("../../src/__koans__/09-gc");
});
