import { describe, expect, it } from "vitest";
import { type ASTNode, composeInterpreters, type InterpreterFragment } from "../../src/core";

function createTrackingFragment(): {
  fragment: InterpreterFragment;
  visitCount: Map<string, number>;
} {
  const visitCount = new Map<string, number>();
  return {
    visitCount,
    fragment: {
      pluginName: "track",
      canHandle: (node) => node.kind.startsWith("track/"),
      async visit(node: ASTNode, recurse: (n: ASTNode) => Promise<unknown>) {
        const id = (node as any).id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        switch (node.kind) {
          case "track/value":
            return node.value;
          case "track/add": {
            const left = (await recurse(node.left as ASTNode)) as number;
            const right = (await recurse(node.right as ASTNode)) as number;
            return left + right;
          }
          case "track/pair": {
            const a = await recurse(node.a as ASTNode);
            const b = await recurse(node.b as ASTNode);
            return [a, b];
          }
          case "track/parallel": {
            const elements = node.elements as ASTNode[];
            return Promise.all(elements.map((e) => recurse(e)));
          }
          default:
            throw new Error(`Unknown track node: ${node.kind}`);
        }
      },
    },
  };
}

describe("DAG memoization", () => {
  it("shared node evaluated once when used by two consumers in sequence", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const shared: ASTNode = { kind: "track/value", id: "shared", value: 5 };
    const addA: ASTNode = {
      kind: "track/add",
      id: "addA",
      left: shared,
      right: { kind: "track/value", id: "lit10", value: 10 } as ASTNode,
    };
    const addB: ASTNode = {
      kind: "track/add",
      id: "addB",
      left: shared,
      right: { kind: "track/value", id: "lit20", value: 20 } as ASTNode,
    };
    const root: ASTNode = { kind: "track/pair", id: "root", a: addA, b: addB };

    const result = await recurse(root);
    expect(result).toEqual([15, 25]);
    expect(visitCount.get("shared")).toBe(1);
  });

  it("diamond dependency: D used by B and C, both used by A", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const D: ASTNode = { kind: "track/value", id: "D", value: 3 };
    const B: ASTNode = {
      kind: "track/add",
      id: "B",
      left: D,
      right: { kind: "track/value", id: "lit10", value: 10 } as ASTNode,
    };
    const C: ASTNode = {
      kind: "track/add",
      id: "C",
      left: D,
      right: { kind: "track/value", id: "lit20", value: 20 } as ASTNode,
    };
    const A: ASTNode = { kind: "track/pair", id: "A", a: B, b: C };

    const result = await recurse(A);
    expect(result).toEqual([13, 23]);
    expect(visitCount.get("D")).toBe(1);
  });

  it("parallel evaluation with shared node (Promise.all)", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const shared: ASTNode = { kind: "track/value", id: "shared", value: 7 };
    const branchA: ASTNode = {
      kind: "track/add",
      id: "branchA",
      left: shared,
      right: { kind: "track/value", id: "lit1", value: 1 } as ASTNode,
    };
    const branchB: ASTNode = {
      kind: "track/add",
      id: "branchB",
      left: shared,
      right: { kind: "track/value", id: "lit2", value: 2 } as ASTNode,
    };
    const root: ASTNode = {
      kind: "track/parallel",
      id: "root",
      elements: [branchA, branchB],
    };

    const result = await recurse(root);
    expect(result).toEqual([8, 9]);
    expect(visitCount.get("shared")).toBe(1);
  });
});
