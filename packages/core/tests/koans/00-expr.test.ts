import { test } from "vitest";

test("placeholder koan gate: 00-expr fixture self-consistency only", async () => {
  await import("../../src/__koans__/00-expr");
});
