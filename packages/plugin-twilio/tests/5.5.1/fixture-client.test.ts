import { describe, expect, it } from "vitest";
import { resolveOperation, sortedStringify } from "./fixture-client";

describe("resolveOperation", () => {
  it("matches POST Messages.json to create_message", () => {
    expect(resolveOperation("POST", "/2010-04-01/Accounts/AC123/Messages.json")).toBe(
      "create_message",
    );
  });

  it("matches GET Messages/{sid}.json to fetch_message", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Messages/SM123.json")).toBe(
      "fetch_message",
    );
  });

  it("matches GET Messages.json to list_messages", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Messages.json")).toBe(
      "list_messages",
    );
  });

  it("matches POST Calls.json to create_call", () => {
    expect(resolveOperation("POST", "/2010-04-01/Accounts/AC123/Calls.json")).toBe("create_call");
  });

  it("matches GET Calls/{sid}.json to fetch_call", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Calls/CA123.json")).toBe(
      "fetch_call",
    );
  });

  it("matches GET Calls.json to list_calls", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Calls.json")).toBe("list_calls");
  });

  it("throws for unknown route", () => {
    expect(() => resolveOperation("DELETE", "/unknown")).toThrow("No matching operation");
  });
});

describe("sortedStringify", () => {
  it("produces stable output regardless of key order", () => {
    const a = sortedStringify({ z: 1, a: 2 });
    const b = sortedStringify({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("handles nested objects", () => {
    const result = sortedStringify({ b: { d: 1, c: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });
});
