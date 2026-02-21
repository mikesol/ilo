import { describe, it } from "vitest";

// DEFERRED: These tests require the fiber plugin to be ported to
// the unified Plugin type. Currently blocked on that port.
// See the original test file in git history for the full test suite.

describe("fiber: composition with postgres (DEFERRED)", () => {
  it.skip("$.par() tuple form — requires fiber plugin port", () => {});
  it.skip("$.par() map form — requires fiber plugin port", () => {});
  it.skip("$.seq() — requires fiber plugin port", () => {});
  it.skip("$.race() — requires fiber plugin port", () => {});
  it.skip("$.timeout() — requires fiber plugin port", () => {});
  it.skip("$.retry() — requires fiber plugin port", () => {});
});
