# Redis Plugin Documentation Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add runnable documentation examples for all 38 redis node kinds, backed by a zero-dependency in-memory Redis client.

**Architecture:** A `MemoryRedisClient` class implements the `RedisClient` interface (`command(cmd, ...args) → Promise`) using in-memory Maps. The playground scope constructs it and passes `createRedisInterpreter(client)` as the interpreter override. Each example follows the `app → prog → foldAST` pipeline.

**Tech Stack:** TypeScript, @mvfm/core, @mvfm/plugin-redis, Astro docs site

---

### Task 1: Create MemoryRedisClient

**Files:**
- Create: `packages/docs/src/memory-redis-client.ts`

**Step 1: Write the implementation**

Create `packages/docs/src/memory-redis-client.ts`. This implements `RedisClient` from `@mvfm/plugin-redis` using in-memory Maps. It handles all 28 Redis commands the interpreter dispatches to.

```typescript
import type { RedisClient } from "@mvfm/plugin-redis";

/**
 * In-memory Redis client for documentation playgrounds.
 *
 * Implements the subset of Redis commands used by the redis plugin
 * interpreter, backed by plain Maps. Not for production use.
 */
export class MemoryRedisClient implements RedisClient {
  private strings = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private ttls = new Map<string, number>();

  async command(command: string, ...args: unknown[]): Promise<unknown> {
    const cmd = command.toUpperCase();
    switch (cmd) {
      // --- String operations ---
      case "GET":
        return this.strings.get(args[0] as string) ?? null;
      case "SET": {
        this.strings.set(args[0] as string, String(args[1]));
        return "OK";
      }
      case "INCR": {
        const key = args[0] as string;
        const val = parseInt(this.strings.get(key) ?? "0", 10) + 1;
        this.strings.set(key, String(val));
        return val;
      }
      case "INCRBY": {
        const key = args[0] as string;
        const val = parseInt(this.strings.get(key) ?? "0", 10) + Number(args[1]);
        this.strings.set(key, String(val));
        return val;
      }
      case "DECR": {
        const key = args[0] as string;
        const val = parseInt(this.strings.get(key) ?? "0", 10) - 1;
        this.strings.set(key, String(val));
        return val;
      }
      case "DECRBY": {
        const key = args[0] as string;
        const val = parseInt(this.strings.get(key) ?? "0", 10) - Number(args[1]);
        this.strings.set(key, String(val));
        return val;
      }
      case "MGET":
        return args.map((k) => this.strings.get(k as string) ?? null);
      case "MSET": {
        for (let i = 0; i < args.length; i += 2) {
          this.strings.set(args[i] as string, String(args[i + 1]));
        }
        return "OK";
      }
      case "APPEND": {
        const key = args[0] as string;
        const current = this.strings.get(key) ?? "";
        const next = current + String(args[1]);
        this.strings.set(key, next);
        return next.length;
      }
      case "GETRANGE": {
        const val = this.strings.get(args[0] as string) ?? "";
        const start = Number(args[1]);
        const end = Number(args[2]);
        return val.slice(start, end + 1);
      }
      case "SETRANGE": {
        const key = args[0] as string;
        const offset = Number(args[1]);
        const value = String(args[2]);
        let current = this.strings.get(key) ?? "";
        current = current.padEnd(offset, "\0") + value + current.slice(offset + value.length);
        // Simplified — real Redis pads with zero bytes
        this.strings.set(key, current);
        return current.length;
      }

      // --- Key operations ---
      case "DEL": {
        let count = 0;
        for (const k of args as string[]) {
          if (this.strings.delete(k) || this.hashes.delete(k) || this.lists.delete(k)) count++;
          this.ttls.delete(k);
        }
        return count;
      }
      case "EXISTS": {
        let count = 0;
        for (const k of args as string[]) {
          if (this.strings.has(k) || this.hashes.has(k) || this.lists.has(k)) count++;
        }
        return count;
      }
      case "EXPIRE": {
        const key = args[0] as string;
        if (this.strings.has(key) || this.hashes.has(key) || this.lists.has(key)) {
          this.ttls.set(key, Date.now() + Number(args[1]) * 1000);
          return 1;
        }
        return 0;
      }
      case "PEXPIRE": {
        const key = args[0] as string;
        if (this.strings.has(key) || this.hashes.has(key) || this.lists.has(key)) {
          this.ttls.set(key, Date.now() + Number(args[1]));
          return 1;
        }
        return 0;
      }
      case "TTL": {
        const expiry = this.ttls.get(args[0] as string);
        if (expiry == null) return -1;
        return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      }
      case "PTTL": {
        const expiry = this.ttls.get(args[0] as string);
        if (expiry == null) return -1;
        return Math.max(0, expiry - Date.now());
      }

      // --- Hash operations ---
      case "HGET": {
        const hash = this.hashes.get(args[0] as string);
        return hash?.get(args[1] as string) ?? null;
      }
      case "HSET": {
        const key = args[0] as string;
        let hash = this.hashes.get(key);
        if (!hash) { hash = new Map(); this.hashes.set(key, hash); }
        let added = 0;
        for (let i = 1; i < args.length; i += 2) {
          if (!hash.has(args[i] as string)) added++;
          hash.set(args[i] as string, String(args[i + 1]));
        }
        return added;
      }
      case "HMGET": {
        const hash = this.hashes.get(args[0] as string);
        return (args.slice(1) as string[]).map((f) => hash?.get(f) ?? null);
      }
      case "HGETALL": {
        const hash = this.hashes.get(args[0] as string);
        if (!hash) return {};
        return Object.fromEntries(hash);
      }
      case "HDEL": {
        const hash = this.hashes.get(args[0] as string);
        if (!hash) return 0;
        let count = 0;
        for (const f of args.slice(1) as string[]) {
          if (hash.delete(f)) count++;
        }
        return count;
      }
      case "HEXISTS": {
        const hash = this.hashes.get(args[0] as string);
        return hash?.has(args[1] as string) ? 1 : 0;
      }
      case "HLEN":
        return this.hashes.get(args[0] as string)?.size ?? 0;
      case "HKEYS":
        return [...(this.hashes.get(args[0] as string)?.keys() ?? [])];
      case "HVALS":
        return [...(this.hashes.get(args[0] as string)?.values() ?? [])];
      case "HINCRBY": {
        const key = args[0] as string;
        const field = args[1] as string;
        let hash = this.hashes.get(key);
        if (!hash) { hash = new Map(); this.hashes.set(key, hash); }
        const val = parseInt(hash.get(field) ?? "0", 10) + Number(args[2]);
        hash.set(field, String(val));
        return val;
      }

      // --- List operations ---
      case "LPUSH": {
        const key = args[0] as string;
        let list = this.lists.get(key);
        if (!list) { list = []; this.lists.set(key, list); }
        for (let i = 1; i < args.length; i++) list.unshift(String(args[i]));
        return list.length;
      }
      case "RPUSH": {
        const key = args[0] as string;
        let list = this.lists.get(key);
        if (!list) { list = []; this.lists.set(key, list); }
        for (let i = 1; i < args.length; i++) list.push(String(args[i]));
        return list.length;
      }
      case "LPOP": {
        const list = this.lists.get(args[0] as string);
        if (!list || list.length === 0) return null;
        return list.shift()!;
      }
      case "RPOP": {
        const list = this.lists.get(args[0] as string);
        if (!list || list.length === 0) return null;
        return list.pop()!;
      }
      case "LLEN":
        return this.lists.get(args[0] as string)?.length ?? 0;
      case "LRANGE": {
        const list = this.lists.get(args[0] as string) ?? [];
        const start = Number(args[1]);
        const stop = Number(args[2]);
        return list.slice(start, stop === -1 ? undefined : stop + 1);
      }
      case "LINDEX": {
        const list = this.lists.get(args[0] as string);
        if (!list) return null;
        const idx = Number(args[1]);
        return list[idx < 0 ? list.length + idx : idx] ?? null;
      }
      case "LSET": {
        const list = this.lists.get(args[0] as string);
        if (!list) throw new Error("ERR no such key");
        const idx = Number(args[1]);
        list[idx < 0 ? list.length + idx : idx] = String(args[2]);
        return "OK";
      }
      case "LREM": {
        const key = args[0] as string;
        const count = Number(args[1]);
        const element = String(args[2]);
        const list = this.lists.get(key);
        if (!list) return 0;
        let removed = 0;
        const limit = count === 0 ? Infinity : Math.abs(count);
        const indices: number[] = [];
        if (count >= 0) {
          for (let i = 0; i < list.length && removed < limit; i++) {
            if (list[i] === element) { indices.push(i); removed++; }
          }
        } else {
          for (let i = list.length - 1; i >= 0 && removed < limit; i--) {
            if (list[i] === element) { indices.push(i); removed++; }
          }
        }
        for (const i of indices.sort((a, b) => b - a)) list.splice(i, 1);
        return removed;
      }
      case "LINSERT": {
        const list = this.lists.get(args[0] as string);
        if (!list) return 0;
        const position = (args[1] as string).toUpperCase();
        const pivot = String(args[2]);
        const element = String(args[3]);
        const idx = list.indexOf(pivot);
        if (idx === -1) return -1;
        list.splice(position === "BEFORE" ? idx : idx + 1, 0, element);
        return list.length;
      }

      default:
        throw new Error(`MemoryRedisClient: unsupported command ${cmd}`);
    }
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit packages/docs/src/memory-redis-client.ts` or `npm run build` from the monorepo root.

**Step 3: Commit**

```bash
git add packages/docs/src/memory-redis-client.ts
git commit -m "feat(docs): add in-memory redis client for playground"
```

---

### Task 2: Add `redis` flag to NodeExample and wire playground

**Files:**
- Modify: `packages/docs/src/examples/types.ts`
- Modify: `packages/docs/src/components/Playground.tsx`
- Modify: `packages/docs/src/playground-scope.ts`
- Modify: `packages/docs/src/pages/[...slug].astro`

**Step 1: Add `redis` field to `NodeExample`**

In `packages/docs/src/examples/types.ts`, add after the `pglite` field:

```typescript
  /** When set, the playground provides an in-memory Redis client. */
  redis?: true;
```

**Step 2: Update Playground.tsx to accept `redis` prop**

In `packages/docs/src/components/Playground.tsx`:

1. Add `redis?: true` to the `PlaygroundProps` interface.
2. Accept it in the component destructure: `{ code: initialCode, pglite, mockInterpreter, redis }`.
3. Pass it through to `createPlaygroundScope`:

```typescript
const scope = await createPlaygroundScope(
  fakeConsole,
  parsedMockInterpreter.current,
  pglite ? dbRef.current : undefined,
  redis,
);
```

**Step 3: Update playground-scope.ts to handle redis**

In `packages/docs/src/playground-scope.ts`:

1. Add `redis?: true` parameter to `createPlaygroundScope`.
2. When `redis` is truthy, import `MemoryRedisClient` and `createRedisInterpreter`, build the interpreter, and inject both `redis` (plugin factory) and `memoryRedisInterpreter` into scope:

```typescript
if (redis) {
  const { MemoryRedisClient } = await import("./memory-redis-client");
  const pluginRedis = await import("@mvfm/plugin-redis");
  const client = new MemoryRedisClient();
  injected.redis = pluginRedis.redis();
  injected.memoryRedisInterpreter = pluginRedis.createRedisInterpreter(client);
}
```

**Step 4: Update [...slug].astro to pass redis prop**

In `packages/docs/src/pages/[...slug].astro`, update the Playground usage on line ~50:

```astro
<Playground code={example.code} pglite={example.pglite} mockInterpreter={example.mockInterpreter} redis={example.redis} client:load />
```

**Step 5: Build and verify**

Run: `npm run build && npm run check`

**Step 6: Commit**

```bash
git add packages/docs/src/examples/types.ts packages/docs/src/components/Playground.tsx packages/docs/src/playground-scope.ts packages/docs/src/pages/[...slug].astro
git commit -m "feat(docs): wire redis flag through playground pipeline"
```

---

### Task 3: Create redis string examples

**Files:**
- Create: `packages/docs/src/examples/redis-strings.ts`

**Step 1: Write examples for 11 string node kinds**

Create `packages/docs/src/examples/redis-strings.ts` with entries for: `redis/get`, `redis/set`, `redis/incr`, `redis/incrby`, `redis/decr`, `redis/decrby`, `redis/mget`, `redis/mset`, `redis/append`, `redis/getrange`, `redis/setrange`.

Each example follows the pattern:
```typescript
const app = mvfm(prelude, console_, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("key", "value"),
    $.redis.get("key")
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);
```

Use `console_` and `$.console.log(...)` where the result is not obvious from the return value. Use `$.begin(...)` to sequence operations. Mark all entries with `plugins: REDIS` and `redis: true`.

Keep under 300 lines.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/redis-strings.ts
git commit -m "feat(docs): add redis string operation examples"
```

---

### Task 4: Create redis key examples

**Files:**
- Create: `packages/docs/src/examples/redis-keys.ts`

**Step 1: Write examples for 6 key node kinds**

`redis/del`, `redis/exists`, `redis/expire`, `redis/pexpire`, `redis/ttl`, `redis/pttl`.

For TTL examples, sequence: set a key → expire it → check TTL. The in-memory client stores absolute timestamps so TTL will return a positive number.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/redis-keys.ts
git commit -m "feat(docs): add redis key operation examples"
```

---

### Task 5: Create redis hash examples

**Files:**
- Create: `packages/docs/src/examples/redis-hashes.ts`

**Step 1: Write examples for 10 hash node kinds**

`redis/hget`, `redis/hset`, `redis/hmget`, `redis/hgetall`, `redis/hdel`, `redis/hexists`, `redis/hlen`, `redis/hkeys`, `redis/hvals`, `redis/hincrby`.

Use a "user:1" hash as a running theme (name, email, age fields).

**Step 2: Commit**

```bash
git add packages/docs/src/examples/redis-hashes.ts
git commit -m "feat(docs): add redis hash operation examples"
```

---

### Task 6: Create redis list examples

**Files:**
- Create: `packages/docs/src/examples/redis-lists.ts`

**Step 1: Write examples for 11 list node kinds**

`redis/lpush`, `redis/rpush`, `redis/lpop`, `redis/rpop`, `redis/llen`, `redis/lrange`, `redis/lindex`, `redis/lset`, `redis/lrem`, `redis/linsert`.

Use a "tasks" list as a running theme.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/redis-lists.ts
git commit -m "feat(docs): add redis list operation examples"
```

---

### Task 7: Wire examples into registry and coverage

**Files:**
- Modify: `packages/docs/src/examples/index.ts`
- Modify: `scripts/check-docs-coverage.ts`

**Step 1: Update examples/index.ts**

Add imports for all four redis example files and include them in the `modules` array:

```typescript
import redisStrings from "./redis-strings";
import redisKeys from "./redis-keys";
import redisHashes from "./redis-hashes";
import redisLists from "./redis-lists";

// Add to modules array:
  redisStrings,
  redisKeys,
  redisHashes,
  redisLists,
```

**Step 2: Update coverage script**

In `scripts/check-docs-coverage.ts`:

1. Add import: `import { redis as redisPlugin } from "../packages/plugin-redis/src/5.4.1/index.js";`
2. Add to plugins array: `redisPlugin(),`

**Step 3: Run coverage check**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: All node kinds have documentation examples (including all 38 redis kinds).

**Step 4: Full validation**

Run: `npm run build && npm run check && npm test`

**Step 5: Commit**

```bash
git add packages/docs/src/examples/index.ts scripts/check-docs-coverage.ts
git commit -m "feat(docs): register redis examples and add coverage check"
```

---

### Task 8: Visual verification

**Step 1: Start dev server**

Run: `npm run dev` (or equivalent in packages/docs)

**Step 2: Navigate to redis examples**

Use Chrome DevTools MCP to visit each redis node kind page and verify:
- Examples render correctly
- Code snippets are syntax-highlighted
- Playground runs without errors
- Output shows expected results

**Step 3: Fix any issues found**

If any examples fail or render incorrectly, fix them.
