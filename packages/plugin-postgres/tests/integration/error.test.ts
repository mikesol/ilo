import { describe, it } from "vitest";

// DEFERRED: These tests require the error plugin to be ported to
// the unified Plugin type. Currently blocked on that port.
// See the original test file in git history for the full test suite.

describe("error: composition with postgres (DEFERRED)", () => {
  it.skip("$.try().catch() — requires error plugin port", () => {});
  it.skip("$.try().match() — requires error plugin port", () => {});
  it.skip("$.attempt() — requires error plugin port", () => {});
  it.skip("$.orElse() — requires error plugin port", () => {});
  it.skip("$.guard() — requires error plugin port", () => {});
  it.skip("$.settle() — requires error plugin port", () => {});
});
