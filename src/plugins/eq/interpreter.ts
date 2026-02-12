import type { ASTNode, InterpreterFragment } from "../../core";

export const eqInterpreter: InterpreterFragment = {
  pluginName: "eq",
  canHandle: (node) => node.kind.startsWith("eq/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "eq/neq":
        return !recurse(node.inner as ASTNode);
      default:
        throw new Error(`Eq interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
