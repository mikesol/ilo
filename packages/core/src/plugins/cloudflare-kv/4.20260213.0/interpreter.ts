import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Cloudflare KV client interface consumed by the handler.
 *
 * Abstracts over the actual KVNamespace binding so handlers
 * can be tested with mock clients.
 */
export interface CloudflareKvClient {
  /** Get a text value by key. */
  get(key: string): Promise<string | null>;
  /** Get a JSON-parsed value by key. */
  getJson<T = unknown>(key: string): Promise<T | null>;
  /** Store a string value at key with optional options. */
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  /** Delete a key. */
  delete(key: string): Promise<void>;
  /** List keys with optional filtering/pagination. */
  list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Generator-based interpreter fragment for cloudflare-kv plugin nodes.
 *
 * Yields `cloudflare-kv/api_call` effects for all 5 operations.
 * Each effect contains the operation name, parameters, and namespace ID.
 */
export const cloudflareKvInterpreter: InterpreterFragment = {
  pluginName: "cloudflare-kv",
  canHandle: (node) => node.kind.startsWith("cloudflare-kv/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const config = node.config as { namespaceId: string };

    switch (node.kind) {
      case "cloudflare-kv/get": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "get",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/get_json": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "get_json",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/put": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "put",
          key,
          value,
          ...(options !== undefined ? { options } : {}),
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/delete": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "delete",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/list": {
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "list",
          ...(options !== undefined ? { options } : {}),
          namespaceId: config.namespaceId,
        };
      }

      default:
        throw new Error(`Cloudflare KV interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
