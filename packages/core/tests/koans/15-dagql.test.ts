import { test } from "vitest";

test("placeholder koan gate: 15-dagql fixture self-consistency only", async () => {
  await import("../../src/__koans__/15-dagql");
});
