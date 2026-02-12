// ============================================================
// ILO DEMO — $.do() and reachability checking
// ============================================================

import { ilo } from "./core";
import { num, str, db, api, jwt, crypto, kv } from "./plugins";

const serverless = ilo(num, str, db("postgres://localhost/myapp"), api, jwt());

// ---- 1. Pure read — no $.do() needed ---------------------

const getUser = serverless(($) => {
  const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
  const posts = $.db.many("SELECT * FROM posts WHERE user_id = $1", [user.id]);
  const published = posts.filter((p: any) => $.eq(p.published, true));
  return published.map((p: any) => ({
    title: p.title,
    author: $.str`${user.firstName} ${user.lastName}`,
    likes: $.add(p.likes, 1),
  }));
});

console.log("✓ getUser compiled (pure read, no $.do needed)");
console.log("  Hash:", getUser.hash);

// ---- 2. Side effects — $.do() required -------------------

const updateAndReturn = serverless(($) => {
  const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);

  return $.do(
    $.db.exec("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]),
    $.api.post($.str`/webhooks/login`, { userId: user.id }),
    user
  );
});

console.log("✓ updateAndReturn compiled (side effects via $.do)");
console.log("  AST result kind:", (updateAndReturn.ast as any).result.kind);
console.log("  Steps:", (updateAndReturn.ast as any).result.steps.length);

// ---- 3. Orphan detection — should THROW -------------------

console.log("\n--- Orphan detection tests ---\n");

try {
  serverless(($) => {
    const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
    $.db.exec("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    return user;
  });
  console.log("✗ Should have thrown for dangling db.exec");
} catch (e: any) {
  console.log("✓ Caught orphan:", e.message.split("\n")[0]);
}

try {
  serverless(($) => {
    const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
    $.api.post("/notify", { userId: user.id });
    return user;
  });
  console.log("✗ Should have thrown for dangling api.post");
} catch (e: any) {
  console.log("✓ Caught orphan:", e.message.split("\n")[0]);
}

try {
  serverless(($) => {
    const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
    $.db.exec("UPDATE a SET x = 1", []);
    $.db.exec("UPDATE b SET y = 2", []);
    $.api.post("/hook", {});
    return user;
  });
  console.log("✗ Should have thrown for multiple orphans");
} catch (e: any) {
  console.log("✓ Caught orphans:", e.message.split("\n")[0]);
}

// ---- 4. Fixed with $.do() --------------------------------

const fixed = serverless(($) => {
  const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
  return $.do(
    $.db.exec("UPDATE a SET x = 1", []),
    $.db.exec("UPDATE b SET y = 2", []),
    $.api.post("/hook", {}),
    user
  );
});
console.log("✓ Fixed version compiled with $.do()");

// ---- 5. Pure computation — no false positives -------------

const pureCalc = ilo(num, str);

const formatPrice = pureCalc(($) => {
  const cents = $.mod($.input.price, 100);
  const dollars = $.floor($.div($.input.price, 100));
  return $.str`$${dollars}.${cents}`;
});
console.log("✓ formatPrice compiled (no false positives)");

// ---- 6. Hash stability -----------------------------------

const getUser2 = serverless(($) => {
  const user = $.db.one("SELECT * FROM users WHERE id = $1", [$.input.id]);
  const posts = $.db.many("SELECT * FROM posts WHERE user_id = $1", [user.id]);
  const published = posts.filter((p: any) => $.eq(p.published, true));
  return published.map((p: any) => ({
    title: p.title,
    author: $.str`${user.firstName} ${user.lastName}`,
    likes: $.add(p.likes, 1),
  }));
});

console.log("\n--- Hash stability ---");
console.log("getUser  hash:", getUser.hash);
console.log("getUser2 hash:", getUser2.hash);
console.log("Match:", getUser.hash === getUser2.hash);
