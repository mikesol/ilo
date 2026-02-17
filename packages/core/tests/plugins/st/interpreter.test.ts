import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { defaults } from "../../../src/defaults";
import type { TypedNode } from "../../../src/fold";
import { foldAST } from "../../../src/fold";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";
import { st } from "../../../src/plugins/st";
import { createStInterpreter } from "../../../src/plugins/st/interpreter";

describe("st interpreter", () => {
  it("provides defaultInterpreter so defaults(app) works without override", () => {
    const app = mvfm(num, semiring, st);
    expect(() => defaults(app)).not.toThrow();
  });

  it("st/let + st/get returns the initial value", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [{ kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 42 } }],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toBe(42);
  });

  it("st/set + st/get returns the updated value", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 1 } },
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: 99 } },
      ],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toBe(99);
  });

  it("st/push appends to an array variable", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: [1] } },
        { kind: "st/push", ref: "st_0", value: { kind: "core/literal", value: 2 } },
      ],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toEqual([1, 2]);
  });

  it("st/get on undefined ref throws", async () => {
    const combined = { ...coreInterpreter, ...createStInterpreter() };
    const node: TypedNode = { kind: "st/get", ref: "st_nonexistent" };
    await expect(foldAST(combined, node)).rejects.toThrow("st/get: unknown ref");
  });

  it("multiple variables are independent", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: "a" } },
        { kind: "st/let", ref: "st_1", initial: { kind: "core/literal", value: "b" } },
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: "x" } },
      ],
      result: {
        kind: "core/tuple",
        elements: [
          { kind: "st/get", ref: "st_0" },
          { kind: "st/get", ref: "st_1" },
        ],
      },
    };
    await expect(foldAST(combined, node)).resolves.toEqual(["x", "b"]);
  });

  it("st/get is not cached (re-reads after mutation return new values)", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const getNode: TypedNode = { kind: "st/get", ref: "st_0" };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 1 } },
        getNode,
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: 2 } },
      ],
      result: getNode,
    };
    await expect(foldAST(combined, node)).resolves.toBe(2);
  });
});
