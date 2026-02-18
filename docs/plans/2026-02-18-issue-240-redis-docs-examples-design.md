# Design: Redis Plugin Documentation Examples (#240)

## Goal

Create documentation examples for all 38 redis node kinds, backed by a custom in-memory `MemoryRedisClient` that runs in the browser playground without dependencies.

## In-Memory Redis Client

### Interface

Satisfies the existing `RedisClient` interface from `@mvfm/plugin-redis`:

```typescript
interface RedisClient {
  command(command: string, ...args: unknown[]): Promise<unknown>;
}
```

### Data Model

- `strings: Map<string, string>` — GET, SET, INCR, DECR, APPEND, GETRANGE, SETRANGE, MGET, MSET
- `hashes: Map<string, Map<string, string>>` — HGET, HSET, HMGET, HGETALL, HDEL, HEXISTS, HLEN, HKEYS, HVALS, HINCRBY
- `lists: Map<string, string[]>` — LPUSH, RPUSH, LPOP, RPOP, LLEN, LRANGE, LINDEX, LSET, LREM, LINSERT
- `ttls: Map<string, number>` — EXPIRE, PEXPIRE, TTL, PTTL (absolute timestamps)
- DEL and EXISTS dispatch across all three data-type maps

### File Location

`packages/docs/src/memory-redis-client.ts` — parallel to `pglite-adapter.ts`.

### Command Coverage (20 distinct commands)

| Category | Commands |
|----------|----------|
| String | GET, SET, INCR, INCRBY, DECR, DECRBY, MGET, MSET, APPEND, GETRANGE, SETRANGE |
| Key | DEL, EXISTS, EXPIRE, PEXPIRE, TTL, PTTL |
| Hash | HGET, HSET, HMGET, HGETALL, HDEL, HEXISTS, HLEN, HKEYS, HVALS, HINCRBY |
| List | LPUSH, RPUSH, LPOP, RPOP, LLEN, LRANGE, LINDEX, LSET, LREM, LINSERT |

## Playground Integration

Mirrors the postgres pattern:

1. `playground-scope.ts` imports `MemoryRedisClient` and `createRedisInterpreter`
2. When a `redis` flag is present on the example, instantiate a fresh `MemoryRedisClient`
3. Build `memoryRedisInterpreter` eagerly and inject into scope
4. Examples pass it explicitly: `defaults(app, { redis: memoryRedisInterpreter })`

### NodeExample Extension

Add an optional `redis: true` field to `NodeExample` (similar to `pglite`).

## Example Structure

`packages/docs/src/examples/redis.ts` — one entry per node kind, grouped by category (strings, keys, hashes, lists). Each example follows the mandatory pipeline:

```typescript
const app = mvfm(prelude, console_, redis());
const prog = app({}, ($) => {
  // use $.redis methods
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);
```

## Wiring

- Register in `packages/docs/src/examples/index.ts`
- Add redis plugin import to `scripts/check-docs-coverage.ts`

## Decisions

- **No external dependencies** — custom MemoryRedisClient over ioredis-mock
- **Fresh client per example** — each playground run gets a clean state
- **Explicit interpreter passing** — matches postgres pattern, no magic
