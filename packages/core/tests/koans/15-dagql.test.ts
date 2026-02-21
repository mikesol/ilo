import { test } from "vitest";

test("koan 15-dagql fixture executes", async () => {
  await import("../../src/__koans__/15-dagql");
});
