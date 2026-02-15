import type { CloudflareKvClient } from "./interpreter";

/**
 * KVNamespace-compatible interface.
 *
 * Matches the subset of the `KVNamespace` type from
 * `@cloudflare/workers-types` that this plugin uses.
 * Avoids a direct dependency on the types package.
 */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  get(key: string, type: "text"): Promise<string | null>;
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { limit?: number; prefix?: string | null; cursor?: string | null }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Wraps a Cloudflare Workers KVNamespace binding into a
 * {@link CloudflareKvClient}.
 *
 * @param kv - A KVNamespace binding from the Workers runtime.
 * @returns A {@link CloudflareKvClient} adapter.
 */
export function wrapKVNamespace(kv: KVNamespaceLike): CloudflareKvClient {
  return {
    async get(key: string): Promise<string | null> {
      return kv.get(key, "text");
    },

    async getJson<T = unknown>(key: string): Promise<T | null> {
      return kv.get<T>(key, "json");
    },

    async put(
      key: string,
      value: string,
      options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
    ): Promise<void> {
      await kv.put(key, value, options);
    },

    async delete(key: string): Promise<void> {
      await kv.delete(key);
    },

    async list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
      keys: Array<{ name: string; expiration?: number }>;
      list_complete: boolean;
      cursor?: string;
    }> {
      const result = await kv.list(options);
      return {
        keys: result.keys.map((k) => ({
          name: k.name,
          ...(k.expiration != null ? { expiration: k.expiration } : {}),
        })),
        list_complete: result.list_complete,
        ...("cursor" in result && result.cursor ? { cursor: result.cursor as string } : {}),
      };
    },
  };
}
