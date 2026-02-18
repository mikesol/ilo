import { join } from "node:path";
import { coreInterpreter, injectInput, mvfm, num, str } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fal as falPlugin } from "../../src/1.9.1";
import { wrapFalSdk } from "../../src/1.9.1/client-fal-sdk";
import { serverEvaluate } from "../../src/1.9.1/handler.server";
import { createRecordingClient, createReplayClient, type FixtureClient } from "./fixture-client";

const FIXTURE_PATH = join(__dirname, "fixtures/integration.json");
const isRecording = !!process.env.FAL_RECORD;

let client: FixtureClient;

beforeAll(async () => {
  if (isRecording) {
    const { fal } = await import("@fal-ai/client");
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) throw new Error("FAL_API_KEY required when FAL_RECORD=1");
    fal.config({ credentials: apiKey });
    client = createRecordingClient(wrapFalSdk(fal), FIXTURE_PATH);
  } else {
    client = createReplayClient(FIXTURE_PATH);
  }
}, 30_000);

afterAll(async () => {
  await client.save();
}, 10_000);

function evaluate(root: unknown) {
  return serverEvaluate(client, coreInterpreter)(root as any);
}

describe("fal integration: real API fixtures", () => {
  it("run returns image data", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) =>
      $.fal.run("fal-ai/fast-sdxl", {
        input: { prompt: "a cat sitting on a windowsill" },
      }),
    );
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("requestId");
    expect(result.data.images).toBeInstanceOf(Array);
    expect(result.data.images.length).toBeGreaterThan(0);
    expect(result.data.images[0]).toHaveProperty("url");
    expect(result.data.images[0]).toHaveProperty("width");
    expect(result.data.images[0]).toHaveProperty("height");
    expect(result.data.seed).toEqual(expect.any(Number));
  }, 30_000);

  it("subscribe returns image data", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) =>
      $.fal.subscribe("fal-ai/fast-sdxl", {
        input: { prompt: "a dog in a park" },
        mode: "polling" as const,
        pollInterval: 1000,
      }),
    );
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("requestId");
    expect(result.data.images.length).toBeGreaterThan(0);
    expect(result.data.images[0].url).toEqual(expect.any(String));
  }, 60_000);

  it("queue submit returns queue status", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) =>
      $.fal.queue.submit("fal-ai/fast-sdxl", {
        input: { prompt: "a mountain landscape" },
      }),
    );
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("request_id");
    expect(result).toHaveProperty("status", "IN_QUEUE");
    expect(result).toHaveProperty("response_url");
    expect(result).toHaveProperty("status_url");
    expect(result).toHaveProperty("cancel_url");
  }, 30_000);

  it("queue status returns status info", async () => {
    // Uses a known requestId from the recorded submit fixture.
    // In record mode, we first submit to get a real requestId.
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "status check target" },
      } as any);
      requestId = (submitted as any).request_id;
      // Wait for completion so status is meaningful
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      // Read the requestId from the recorded queueSubmit fixture for "status check target"
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: any) => e.method === "queueSubmit" && e.input?.input?.prompt === "status check target",
      );
      requestId = submitEntry.response.request_id;
    }

    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) => $.fal.queue.status("fal-ai/fast-sdxl", { requestId, logs: true }));
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]).toContain(result.status);
    expect(result).toHaveProperty("request_id");
  }, 30_000);

  it("queue result returns completed data", async () => {
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "result target" },
      } as any);
      requestId = (submitted as any).request_id;
      // Wait for completion
      await new Promise((r) => setTimeout(r, 8000));
    } else {
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: any) => e.method === "queueSubmit" && e.input?.input?.prompt === "result target",
      );
      requestId = submitEntry.response.request_id;
    }

    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) => $.fal.queue.result("fal-ai/fast-sdxl", { requestId }));
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("requestId");
    expect(result.data.images.length).toBeGreaterThan(0);
  }, 30_000);

  it("queue cancel returns undefined", async () => {
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "cancel me" },
      } as any);
      requestId = (submitted as any).request_id;
    } else {
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: any) => e.method === "queueSubmit" && e.input?.input?.prompt === "cancel me",
      );
      requestId = submitEntry.response.request_id;
    }

    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) => $.fal.queue.cancel("fal-ai/fast-sdxl", { requestId }));
    const cancelResult = await evaluate(injectInput(prog, {}).ast.result);
    expect(cancelResult).toBeUndefined();
  }, 30_000);
});
