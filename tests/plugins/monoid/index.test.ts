import { str } from "@mvfm/core";
import { describe, expect, it } from "vitest";

describe("monoid: trait declarations", () => {
  it("str declares monoid trait", () => {
    expect(str.traits?.monoid).toEqual({
      type: "string",
      nodeKinds: { mempty: "str/mempty" },
    });
  });
});
