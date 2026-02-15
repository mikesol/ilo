import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { CloudflareKvClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Cloudflare KV
 * effects against a real KV client.
 *
 * Handles `cloudflare-kv/api_call` effects by delegating to the
 * appropriate client method based on the operation field.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: CloudflareKvClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "cloudflare-kv/api_call") {
      const {
        operation,
        key,
        value: val,
        options,
      } = effect as {
        type: "cloudflare-kv/api_call";
        operation: string;
        key?: string;
        value?: string;
        options?: Record<string, unknown>;
      };

      let result: unknown;

      switch (operation) {
        case "get":
          result = await client.get(key as string);
          break;
        case "get_json":
          result = await client.getJson(key as string);
          break;
        case "put":
          result = await client.put(key as string, val as string, options);
          break;
        case "delete":
          result = await client.delete(key as string);
          break;
        case "list":
          result = await client.list(options);
          break;
        default:
          throw new Error(`serverHandler: unknown KV operation "${operation}"`);
      }

      return { value: result, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Cloudflare KV client using the provided interpreter fragments.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: CloudflareKvClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
