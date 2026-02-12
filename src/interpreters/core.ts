import type { ASTNode, InterpreterFragment } from "../core";

export const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = recurse(node.object as ASTNode) as Record<string, unknown>;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const result: Record<string, unknown> = {};
        for (const [key, fieldNode] of Object.entries(fields)) {
          result[key] = recurse(fieldNode);
        }
        return result;
      }

      case "core/cond": {
        const predicate = recurse(node.predicate as ASTNode);
        if (predicate && typeof (predicate as any).then === "function") {
          const condExpr = async () => {
            const resolved = await predicate;
            return resolved
              ? await Promise.resolve(recurse(node.then as ASTNode))
              : await Promise.resolve(recurse(node.else as ASTNode));
          };
          return condExpr();
        }
        return predicate ? recurse(node.then as ASTNode) : recurse(node.else as ASTNode);
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        // Execute steps, switching to async if any returns a Promise
        for (let i = 0; i < steps.length; i++) {
          const result = recurse(steps[i]);
          if (result && typeof (result as any).then === "function") {
            // Async step detected — finish remaining steps asynchronously
            const doExpr = async () => {
              await result;
              for (let j = i + 1; j < steps.length; j++) {
                await Promise.resolve(recurse(steps[j]));
              }
              return await Promise.resolve(recurse(node.result as ASTNode));
            };
            return doExpr();
          }
        }
        return recurse(node.result as ASTNode);
      }

      case "core/program":
        return recurse(node.result as ASTNode);

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        return elements.map((el) => recurse(el));
      }

      case "core/lambda_param":
        return (node as any).__value;

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
