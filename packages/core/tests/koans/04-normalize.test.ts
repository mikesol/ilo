import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 04-normalize: createApp resolves traits and lifts literals", () => {
  const app = koan.createApp(...koan.stdPlugins, koan.ordPlugin);

  const ltProg = app(koan.lt(3, 4));
  expect(ltProg.__adj[ltProg.__id]?.kind).toBe("num/lt");

  const eqProg = app(koan.eq("a", "b"));
  expect(eqProg.__adj[eqProg.__id]?.kind).toBe("str/eq");

  const addProg = app(koan.add(1, 2));
  expect(addProg.__adj[addProg.__id]?.kind).toBe("num/add");
  expect(Object.keys(addProg.__adj).length).toBe(3);
});
