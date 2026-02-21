import { test } from "vitest";

test("placeholder koan gate: 14-named fixture self-consistency only", async () => {
  await import("../../src/__koans__/14-named");
});
