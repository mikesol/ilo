import { describe, it } from "vitest";

// DEFERRED: These tests require error + fiber plugins to be ported
// to the unified Plugin type. Currently blocked on those ports.
// See the original test file in git history for the full test suite.

describe("composition: postgres + fiber (DEFERRED)", () => {
  it.skip("$.par wrapping postgres queries — requires fiber plugin port", () => {});
  it.skip("$.par map form — requires fiber plugin port", () => {});
});

describe("composition: postgres + error (DEFERRED)", () => {
  it.skip("$.try wrapping postgres query — requires error plugin port", () => {});
  it.skip("$.guard inside transaction — requires error plugin port", () => {});
});

describe("composition: postgres + fiber + error (DEFERRED)", () => {
  it.skip("full stack composition — requires error + fiber plugin port", () => {});
});
