import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { slack } from "../../src/7.14.0";
import { createSlackInterpreter } from "../../src/7.14.0/generated/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, slack({ token: "xoxb-fixture" }));

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createSlackInterpreter(fixtureClient),
    ...coreInterpreter,
  };
  return await foldAST(combined, injected);
}

describe("slack fixture integration", () => {
  it("auth.test returns bot identity", async () => {
    const prog = app(($) => $.slack.auth.test());
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(result.user_id).toBeDefined();
    expect(result.team_id).toBeDefined();
  });

  it("conversations.list returns channels", async () => {
    const prog = app(($) => $.slack.conversations.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
  });

  it("users.list returns members", async () => {
    const prog = app(($) => $.slack.users.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.members)).toBe(true);
  });
});
