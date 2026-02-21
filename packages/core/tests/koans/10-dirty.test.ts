import { test } from "vitest";

test("placeholder koan gate: 10-dirty fixture self-consistency only", async () => {
  await import("../../src/__koans__/10-dirty");
});
