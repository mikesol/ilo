import { test } from "vitest";

test("placeholder koan gate: 02-build fixture self-consistency only", async () => {
  await import("../../src/__koans__/02-build");
});
