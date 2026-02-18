import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnthropicClient } from "../../src/0.74.0/interpreter";

/** Shape of a recorded fixture file. */
export interface Fixture {
  request: { method: string; path: string; params?: Record<string, unknown> };
  response: unknown;
}

/** Route table entry mapping HTTP method + path regex to an operation name. */
interface Route {
  method: string;
  pattern: RegExp;
  operation: string;
}

const routes: Route[] = [
  { method: "POST", pattern: /^\/v1\/messages\/count_tokens(\?|$)/, operation: "count_tokens" },
  {
    method: "POST",
    pattern: /^\/v1\/messages\/batches\/[^/]+\/cancel(\?|$)/,
    operation: "cancel_message_batch",
  },
  { method: "POST", pattern: /^\/v1\/messages\/batches(\?|$)/, operation: "create_message_batch" },
  { method: "POST", pattern: /^\/v1\/messages(\?|$)/, operation: "create_message" },
  {
    method: "GET",
    pattern: /^\/v1\/messages\/batches\/[^/]+$/,
    operation: "retrieve_message_batch",
  },
  { method: "GET", pattern: /^\/v1\/messages\/batches(\?|$)/, operation: "list_message_batches" },
  {
    method: "DELETE",
    pattern: /^\/v1\/messages\/batches\/[^/]+$/,
    operation: "delete_message_batch",
  },
  { method: "GET", pattern: /^\/v1\/models\/[^/]+$/, operation: "retrieve_model" },
  { method: "GET", pattern: /^\/v1\/models(\?|$)/, operation: "list_models" },
];

/**
 * Resolve an HTTP method + path to the canonical operation name.
 * Query strings are stripped before matching.
 */
export function resolveOperation(method: string, path: string): string {
  const stripped = path.split("?")[0];
  for (const route of routes) {
    if (route.method === method && route.pattern.test(stripped)) {
      return route.operation;
    }
  }
  throw new Error(`No matching operation for ${method} ${path}`);
}

/**
 * Deterministic JSON stringify with sorted object keys.
 * Recursively sorts keys so structurally-equal objects produce identical strings.
 */
export function sortedStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Create a replay {@link AnthropicClient} that serves responses from JSON
 * fixture files and detects contract drift when request params change.
 *
 * @param fixturesDir - Absolute path to the directory containing fixture JSON files.
 * @returns An {@link AnthropicClient} backed by fixtures.
 */
export function createFixtureClient(fixturesDir: string): AnthropicClient {
  const cache = new Map<string, Fixture>();

  function loadFixture(operation: string): Fixture {
    const cached = cache.get(operation);
    if (cached) return cached;

    const filePath = join(fixturesDir, `${operation}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const fixture = JSON.parse(raw) as Fixture;
    cache.set(operation, fixture);
    return fixture;
  }

  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const operation = resolveOperation(method, path);
      const fixture = loadFixture(operation);

      if (fixture.request.params !== undefined) {
        const expected = sortedStringify(fixture.request.params);
        const actual = sortedStringify(params);
        if (expected !== actual) {
          throw new Error(
            `Contract drift detected for "${operation}".\n` +
              `Expected params: ${expected}\n` +
              `Actual params:   ${actual}`,
          );
        }
      }

      return fixture.response;
    },
  };
}
