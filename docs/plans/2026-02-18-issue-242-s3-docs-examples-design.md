# Design: S3 Plugin Documentation Examples (#242)

## Overview

Add documentation examples for all 5 S3 node kinds, backed by an in-memory S3 mock for the browser playground.

## Components

### 1. `packages/docs/src/memory-s3-client.ts` (~80-100 lines)

In-memory implementation of the `S3Client` interface from `@mvfm/plugin-s3`.

- **Storage:** `Map<bucket, Map<key, { body: string; contentType?: string; metadata?: Record<string,string> }>>`
- **Interface:** `execute(command: string, input: Record<string, unknown>): Promise<unknown>`
- **Commands:** PutObject, GetObject, DeleteObject, HeadObject, ListObjectsV2
- **Returns:** AWS SDK-shaped response objects (ETag, ContentLength, Contents[], etc.)

Mirrors `memory-redis-client.ts` pattern.

### 2. `packages/docs/src/examples/s3.ts`

Five examples, one per node kind:

| Kind | Description | Strategy |
|------|-------------|----------|
| `s3/put_object` | Upload a text object | Put a string Body |
| `s3/get_object` | Download an object | Put then get (like redis set/get) |
| `s3/delete_object` | Delete an object | Put then delete |
| `s3/head_object` | Check object metadata | Put then head |
| `s3/list_objects_v2` | List objects by prefix | Seed several objects, list with Prefix |

All use `s3({ region: "us-east-1" })` config and `memoryS3Interpreter`.

### 3. `packages/docs/src/examples/types.ts`

Add `s3?: true` flag to `NodeExample` (same pattern as `redis?: true`).

### 4. `packages/docs/src/playground-scope.ts`

Add `s3?: true` parameter. When set, lazy-import `MemoryS3Client` and `@mvfm/plugin-s3`, create client and interpreter, inject as `s3_` and `memoryS3Interpreter`.

### 5. `packages/docs/src/examples/index.ts`

Import and register the s3 examples module.

### 6. `scripts/check-docs-coverage.ts`

Add `s3` plugin import so coverage checks include S3 node kinds.

## Design decisions

- **Body is a string.** The real SDK adapter already converts streaming Body to string. The mock stores and returns strings directly. Natural for doc examples (JSON payloads, text content).
- **Realistic config.** Examples use `s3({ region: "us-east-1" })` — config is ignored by mock but looks like real AWS code.
- **Single file for examples.** 5 examples fit comfortably in one file under 300 lines.
