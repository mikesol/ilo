# Anthropic Fixture-Based Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add integration tests for the anthropic plugin that replay recorded API fixtures, catching response shape mismatches and contract drift.

**Architecture:** Intercept at the `AnthropicClient.request()` boundary. A fixture client loads JSON fixtures (one per operation), compares request params for drift detection, and returns recorded responses. A separate recording script hits the real API once to generate fixtures.

**Tech Stack:** Vitest, existing `AnthropicClient` interface, `@anthropic-ai/sdk` (for recording only)

---

### Task 1: Create fixture client utility

**Files:**
- Create: `packages/plugin-anthropic/tests/0.74.0/fixture-client.ts`

**Step 1: Write `fixture-client.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnthropicClient } from "../../src/0.74.0/interpreter";

/** A recorded fixture: the request that was sent and the response received. */
interface Fixture {
  request: { method: string; path: string; params?: Record<string, unknown> };
  response: unknown;
}

/** Route table: [httpMethod, pathPattern, operationName] */
const ROUTE_TABLE: Array<[string, RegExp, string]> = [
  ["POST", /^\/v1\/messages$/, "create_message"],
  ["POST", /^\/v1\/messages\/count_tokens$/, "count_tokens"],
  ["POST", /^\/v1\/messages\/batches$/, "create_message_batch"],
  ["GET", /^\/v1\/messages\/batches\/[^/]+$/, "retrieve_message_batch"],
  ["GET", /^\/v1\/messages\/batches(\?|$)/, "list_message_batches"],
  ["DELETE", /^\/v1\/messages\/batches\/[^/]+$/, "delete_message_batch"],
  ["POST", /^\/v1\/messages\/batches\/[^/]+\/cancel$/, "cancel_message_batch"],
  ["GET", /^\/v1\/models\/[^/]+$/, "retrieve_model"],
  ["GET", /^\/v1\/models(\?|$)/, "list_models"],
];

function resolveOperation(method: string, path: string): string {
  const cleanPath = path.split("?")[0];
  for (const [m, pattern, name] of ROUTE_TABLE) {
    if (method === m && pattern.test(cleanPath)) return name;
  }
  throw new Error(`Unknown Anthropic operation: ${method} ${path}`);
}

function sortedStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/**
 * Creates a fixture-replaying AnthropicClient.
 *
 * For param-based operations, compares request params against the fixture
 * and throws on mismatch (contract drift detection).
 * For ID-based operations (retrieve/delete/cancel), returns the fixture
 * response without param comparison (the ID is in the path).
 */
export function createFixtureClient(fixturesDir: string): AnthropicClient {
  const cache = new Map<string, Fixture>();

  function loadFixture(operation: string): Fixture {
    if (!cache.has(operation)) {
      const raw = readFileSync(join(fixturesDir, `${operation}.json`), "utf-8");
      cache.set(operation, JSON.parse(raw));
    }
    return cache.get(operation)!;
  }

  return {
    async request(method, path, params) {
      const operation = resolveOperation(method, path);
      const fixture = loadFixture(operation);

      // Contract drift: compare params for param-based operations
      if (fixture.request.params !== undefined) {
        const expected = sortedStringify(fixture.request.params);
        const actual = sortedStringify(params);
        if (expected !== actual) {
          throw new Error(
            `Contract drift in ${operation}:\n` +
              `  Expected params: ${expected}\n` +
              `  Actual params:   ${actual}`,
          );
        }
      }

      return fixture.response;
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/plugin-anthropic/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/plugin-anthropic/tests/0.74.0/fixture-client.ts
git commit -m "test(anthropic): add fixture replay client for integration tests"
```

---

### Task 2: Create recording script

**Files:**
- Create: `packages/plugin-anthropic/tests/0.74.0/record-fixtures.ts`

**Step 1: Write `record-fixtures.ts`**

This script hits the real Anthropic API and saves `{request, response}` JSON fixtures. It reads `ANTHROPIC_API_KEY` from the root `.env` file. Run manually when fixtures need refreshing.

```ts
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const ROOT = join(__dirname, "../../../..");

// Read API key from root .env
const envContent = readFileSync(join(ROOT, ".env"), "utf-8");
const apiKey = envContent.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in root .env");

function save(name: string, request: Record<string, unknown>, response: unknown) {
  writeFileSync(
    join(FIXTURES_DIR, `${name}.json`),
    `${JSON.stringify({ request, response }, null, 2)}\n`,
  );
  console.log(`  saved ${name}`);
}

async function record() {
  // Dynamic import to avoid requiring SDK at module level
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const { wrapAnthropicSdk } = await import("../../src/0.74.0/client-anthropic-sdk");

  const sdk = new Anthropic({ apiKey });
  const client = wrapAnthropicSdk(sdk);

  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log("Recording Anthropic API fixtures...\n");

  // ---- Messages ----

  const createParams = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 16,
    messages: [{ role: "user" as const, content: "Say hello in exactly one word." }],
  };
  const createResp = await client.request("POST", "/v1/messages", createParams);
  save("create_message", { method: "POST", path: "/v1/messages", params: createParams }, createResp);

  const countParams = {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user" as const, content: "Hello" }],
  };
  const countResp = await client.request("POST", "/v1/messages/count_tokens", countParams);
  save("count_tokens", { method: "POST", path: "/v1/messages/count_tokens", params: countParams }, countResp);

  // ---- Batches ----

  const batchParams = {
    requests: [
      {
        custom_id: "fixture-req-001",
        params: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user" as const, content: "Say hi." }],
        },
      },
    ],
  };
  const batchResp = (await client.request("POST", "/v1/messages/batches", batchParams)) as any;
  const batchId: string = batchResp.id;
  save("create_message_batch", { method: "POST", path: "/v1/messages/batches", params: batchParams }, batchResp);

  const retrievePath = `/v1/messages/batches/${batchId}`;
  const retrieveResp = await client.request("GET", retrievePath);
  save("retrieve_message_batch", { method: "GET", path: retrievePath }, retrieveResp);

  const listParams = { limit: 10 };
  const listResp = await client.request("GET", "/v1/messages/batches", listParams);
  save("list_message_batches", { method: "GET", path: "/v1/messages/batches", params: listParams }, listResp);

  const cancelPath = `/v1/messages/batches/${batchId}/cancel`;
  const cancelResp = await client.request("POST", cancelPath);
  save("cancel_message_batch", { method: "POST", path: cancelPath }, cancelResp);

  // Poll until batch reaches terminal state so we can delete
  console.log("  waiting for batch to reach terminal state...");
  let status = "canceling";
  while (status !== "canceled" && status !== "ended" && status !== "expired") {
    await new Promise((r) => setTimeout(r, 2000));
    const check = (await client.request("GET", `/v1/messages/batches/${batchId}`)) as any;
    status = check.processing_status;
    console.log(`    batch status: ${status}`);
  }

  const deletePath = `/v1/messages/batches/${batchId}`;
  const deleteResp = await client.request("DELETE", deletePath);
  save("delete_message_batch", { method: "DELETE", path: deletePath }, deleteResp);

  // ---- Models ----

  const modelPath = "/v1/models/claude-sonnet-4-20250514";
  const modelResp = await client.request("GET", modelPath);
  save("retrieve_model", { method: "GET", path: modelPath }, modelResp);

  const listModelsParams = { limit: 5 };
  const listModelsResp = await client.request("GET", "/v1/models", listModelsParams);
  save("list_models", { method: "GET", path: "/v1/models", params: listModelsParams }, listModelsResp);

  console.log("\nDone! Fixtures saved to", FIXTURES_DIR);
}

record().catch((err) => {
  console.error("Recording failed:", err);
  process.exit(1);
});
```

**Step 2: Commit the script (before running — fixtures come next)**

```bash
git add packages/plugin-anthropic/tests/0.74.0/record-fixtures.ts
git commit -m "test(anthropic): add fixture recording script"
```

---

### Task 3: Record fixtures from real API

**Step 1: Run the recording script**

Run: `cd packages/plugin-anthropic && npx tsx tests/0.74.0/record-fixtures.ts`
Expected: 9 JSON files created in `tests/0.74.0/fixtures/`

**Step 2: Verify fixture files exist and look correct**

Run: `ls packages/plugin-anthropic/tests/0.74.0/fixtures/`
Expected: `cancel_message_batch.json  count_tokens.json  create_message.json  create_message_batch.json  delete_message_batch.json  list_message_batches.json  list_models.json  retrieve_message_batch.json  retrieve_model.json`

Spot-check a few files. Verify `create_message.json` has `response.type === "message"`, `response.content` is an array, etc.

**Step 3: Commit fixtures**

```bash
git add packages/plugin-anthropic/tests/0.74.0/fixtures/
git commit -m "test(anthropic): add recorded API fixtures for integration tests"
```

---

### Task 4: Write integration tests

**Files:**
- Create: `packages/plugin-anthropic/tests/0.74.0/integration.test.ts`

**Step 1: Write `integration.test.ts`**

The test params for param-based operations MUST exactly match what was used in the recording script. The fixture client will throw on any mismatch (contract drift detection).

Response shape assertions verify the real API response matches our expected types. Fixtures are the source of truth — if assertions fail, fix our types/expectations to match the SDK, not the other way around.

```ts
import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  foldAST,
  injectInput,
  mvfm,
  num,
  str,
} from "@mvfm/core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropic } from "../../src/0.74.0";
import { createAnthropicInterpreter } from "../../src/0.74.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));

const app = mvfm(num, str, anthropic({ apiKey: "sk-ant-fixture" }), fiber, error);

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createAnthropicInterpreter(fixtureClient),
    ...errorInterpreter,
    ...fiberInterpreter,
    ...coreInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Messages
// ============================================================

describe("anthropic integration: messages", () => {
  it("create message returns Message shape", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16,
        messages: [{ role: "user", content: "Say hello in exactly one word." }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.type).toBe("message");
    expect(result.role).toBe("assistant");
    expect(result.id).toMatch(/^msg_/);
    expect(result.model).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    expect(result.stop_reason).toBeDefined();
    expect(result.usage).toBeDefined();
    expect(result.usage.input_tokens).toBeGreaterThan(0);
    expect(result.usage.output_tokens).toBeGreaterThan(0);
  });

  it("count tokens returns MessageTokensCount shape", async () => {
    const prog = app(($) =>
      $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.input_tokens).toBeGreaterThan(0);
  });
});

// ============================================================
// Batches
// ============================================================

describe("anthropic integration: batches", () => {
  it("create batch returns MessageBatch shape", async () => {
    const prog = app(($) =>
      $.anthropic.messages.batches.create({
        requests: [
          {
            custom_id: "fixture-req-001",
            params: {
              model: "claude-sonnet-4-20250514",
              max_tokens: 16,
              messages: [{ role: "user", content: "Say hi." }],
            },
          },
        ],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBeDefined();
  });

  it("retrieve batch returns MessageBatch shape", async () => {
    const prog = app(($) => $.anthropic.messages.batches.retrieve("msgbatch_fixture"));
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
  });

  it("list batches returns page shape", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("cancel batch returns MessageBatch shape", async () => {
    const prog = app(($) => $.anthropic.messages.batches.cancel("msgbatch_fixture"));
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
  });

  it("delete batch returns DeletedMessageBatch shape", async () => {
    const prog = app(($) => $.anthropic.messages.batches.delete("msgbatch_fixture"));
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch_deleted");
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic integration: models", () => {
  it("retrieve model returns ModelInfo shape", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("claude-sonnet-4-20250514");
    expect(result.type).toBe("model");
    expect(result.display_name).toBeDefined();
  });

  it("list models returns page shape", async () => {
    const prog = app(($) => $.anthropic.models.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe("model");
  });
});

// ============================================================
// Composition: error + anthropic
// ============================================================

describe("composition: error + anthropic", () => {
  it("$.attempt wraps successful anthropic call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + anthropic
// ============================================================

describe("composition: fiber + anthropic", () => {
  it("$.par runs two anthropic calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("message");
  });
});
```

**Step 2: Run the tests**

Run: `cd packages/plugin-anthropic && npx vitest run tests/0.74.0/integration.test.ts`
Expected: All tests pass

If any response shape assertion fails, update the assertion to match the fixture (fixtures are the source of truth).

**Step 3: Run full test suite to confirm nothing broke**

Run: `cd packages/plugin-anthropic && npx vitest run`
Expected: All existing + new tests pass

**Step 4: Commit**

```bash
git add packages/plugin-anthropic/tests/0.74.0/integration.test.ts
git commit -m "test(anthropic): add fixture-based integration tests (#75)"
```

---

### Task 5: Final validation

**Step 1: Run build + check + test**

Run: `npm run build && npm run check && npm test` (from monorepo root)
Expected: All pass

**Step 2: Verify file sizes**

All new files must be under 300 lines:
- `fixture-client.ts`: ~70 lines
- `record-fixtures.ts`: ~100 lines
- `integration.test.ts`: ~180 lines
