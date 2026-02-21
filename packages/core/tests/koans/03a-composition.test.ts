import { test } from "vitest";

test("placeholder koan gate: 03a-composition fixture self-consistency only", async () => {
  await import("../../src/__koans__/03a-composition");
});
