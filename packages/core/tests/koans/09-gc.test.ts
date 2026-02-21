import { test } from "vitest";

test("placeholder koan gate: 09-gc fixture self-consistency only", async () => {
  await import("../../src/__koans__/09-gc");
});
