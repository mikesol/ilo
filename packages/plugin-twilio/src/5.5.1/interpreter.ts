import { createRequire } from "node:module";
import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
import { wrapTwilioSdk } from "./client-twilio-sdk";

/**
 * Twilio client interface consumed by the twilio handler.
 *
 * Abstracts over the actual Twilio SDK so handlers can be
 * tested with mock clients.
 */
export interface TwilioClient {
  /** Execute a Twilio API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

interface TwilioNode extends TypedNode<unknown> {
  kind: string;
  sid?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
  config: { accountSid: string; authToken: string };
}

/**
 * Creates an interpreter for `twilio/*` node kinds.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @returns An Interpreter handling all twilio node kinds.
 */
export function createTwilioInterpreter(client: TwilioClient): Interpreter {
  return {
    "twilio/create_message": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params!);
      return await client.request("POST", `${base}/Messages.json`, params);
    },

    "twilio/fetch_message": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid!);
      return await client.request("GET", `${base}/Messages/${sid}.json`);
    },

    "twilio/list_messages": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", `${base}/Messages.json`, params);
    },

    "twilio/create_call": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params!);
      return await client.request("POST", `${base}/Calls.json`, params);
    },

    "twilio/fetch_call": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid!);
      return await client.request("GET", `${base}/Calls/${sid}.json`);
    },

    "twilio/list_calls": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", `${base}/Calls.json`, params);
    },
  };
}

function requiredEnv(name: "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-twilio: missing ${name}. Set ${name} or use createTwilioInterpreter(...)`,
    );
  }
  return value;
}

function createDefaultTwilioClient(): unknown {
  const require = createRequire(import.meta.url);
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  let moduleValue: unknown;
  try {
    moduleValue = require("twilio");
  } catch {
    return {
      async request(opts: {
        method: string;
        uri: string;
        data?: Record<string, unknown>;
      }): Promise<{ body: unknown }> {
        const encodedAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
        const response = await fetch(opts.uri, {
          method: opts.method,
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body:
            opts.data == null
              ? undefined
              : new URLSearchParams(
                  Object.entries(opts.data).map(([key, value]) => [key, String(value)]),
                ).toString(),
        });
        return { body: await response.json() };
      },
    };
  }
  const twilioFactory =
    typeof moduleValue === "function"
      ? moduleValue
      : (moduleValue as { default?: unknown }).default;
  if (typeof twilioFactory !== "function") {
    throw new Error("@mvfm/plugin-twilio: failed to load `twilio` client factory");
  }
  return twilioFactory(accountSid, authToken);
}

function lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

/**
 * Default Twilio interpreter that uses `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
 */
export const twilioInterpreter: Interpreter = lazyInterpreter(() =>
  createTwilioInterpreter(wrapTwilioSdk(createDefaultTwilioClient() as any)),
);
