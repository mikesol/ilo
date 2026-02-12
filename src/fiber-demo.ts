// ============================================================
// postgres + fiber: composing concurrency with database access
// ============================================================
//
// The key insight: postgres doesn't know about fiber.
// fiber doesn't know about postgres. They compose at the
// user level because fiber operates on any Expr<T>.
//
// ============================================================

import { ilo } from "./core";
import { num, str } from "./plugins";
import { postgres } from "./postgres-plugin";
import { fiber } from "./fiber-plugin";

// Compose the stack
const app = ilo(num, str, postgres("postgres://localhost/myapp"), fiber);

// ---- 1. Basic usage (unchanged from before) ---------------
//
// Nothing about fiber leaks into simple queries.
// You only use it when you want concurrency.

const getUser = app(($) => {
  const user = $.sql`select * from users where id = ${$.input.id}`;
  const posts = $.sql`select * from posts where user_id = ${user[0].id}`;
  return { user: user[0], posts };
});
console.log("✓ Basic query (unchanged)");

// ---- 2. Parallel independent queries ---------------------
//
// Two queries with no data dependency? Run them in parallel.
//
// WITHOUT fiber:
//   return { users, posts }
//   // interpreter may or may not parallelize — undefined
//
// WITH fiber:
//   return $.par(users, posts)
//   // explicitly parallel — it's in the AST, verifiable

const getDashboard = app(($) => {
  const users = $.sql`select count(*) from users`;
  const posts = $.sql`select count(*) from posts`;
  const comments = $.sql`select count(*) from comments`;

  // All three run concurrently, result is a tuple
  return $.par(users, posts, comments);
});
console.log("✓ Parallel independent queries");

// ---- 3. Fan-out with bounded concurrency -----------------
//
// This is the killer feature. Process a list of items
// with controlled parallelism.
//
// Real-world: "enrich each user with their latest post,
// but don't fire 10,000 concurrent queries"

const enrichUsers = app(($) => {
  const users = $.sql`select * from users where active = true`;

  // Process 5 at a time
  const enriched = $.par(users, { concurrency: 5 }, (user) =>
    $.sql`select * from posts where user_id = ${user.id} order by created_at desc limit 1`
  );

  return enriched;
});
console.log("✓ Fan-out with concurrency: 5");

// ---- 4. Parallel queries + sequential writes --------------
//
// Read in parallel, then write sequentially.
// Mixing $.par and $.do naturally.

const syncUserStats = app(($) => {
  // Fetch from two sources concurrently
  const data = $.par(
    $.sql`select user_id, count(*) as post_count from posts group by user_id`,
    $.sql`select user_id, count(*) as comment_count from comments group by user_id`
  );

  // Then write the combined result (sequentially, in a transaction)
  return $.sql.begin((sql) => {
    return $.do(
      sql`update user_stats set post_count = ${data[0]}, comment_count = ${data[1]}`,
      sql`update sync_log set last_sync = now()`,
      data
    );
  });
});
console.log("✓ Parallel reads + sequential transaction");

// ---- 5. Race: first response wins ------------------------

const getWithFallback = app(($) => {
  return $.race(
    $.sql`select * from users_primary where id = ${$.input.id}`,
    $.sql`select * from users_replica where id = ${$.input.id}`
  );
});
console.log("✓ Race between primary and replica");

// ---- 6. Timeout with fallback ----------------------------

const getWithTimeout = app(($) => {
  return $.timeout(
    $.sql`select * from slow_materialized_view where id = ${$.input.id}`,
    5000,
    { error: "timeout", data: null }
  );
});
console.log("✓ Timeout with fallback");

// ---- 7. Retry flaky operations ---------------------------

const resilientFetch = app(($) => {
  return $.retry(
    $.sql`select * from external_data_cache where key = ${$.input.key}`,
    { attempts: 3, delay: 1000 }
  );
});
console.log("✓ Retry with backoff");

// ---- 8. Complex composition ------------------------------
//
// This is where it gets powerful. All the primitives compose.
//
// "For each active user (5 at a time), fetch their posts
// and comments in parallel, retry on failure, timeout after 2s"

const fullEnrichment = app(($) => {
  const users = $.sql`select * from users where active = true`;

  return $.par(users, { concurrency: 5 }, (user) =>
    $.timeout(
      $.retry(
        $.par(
          $.sql`select * from posts where user_id = ${user.id}`,
          $.sql`select * from comments where user_id = ${user.id}`
        ),
        { attempts: 2, delay: 500 }
      ),
      3000,
      { posts: [], comments: [] }
    )
  );
});
console.log("✓ Complex: par(5) → retry(2) → par → timeout(3s)");

// ---- 9. The whole point: everything is in the AST ---------
//
// The concurrency structure is part of the verified program.
// The proxy server knows:
//   - This program runs at most 5 enrichments concurrently
//   - Each enrichment makes exactly 2 parallel queries
//   - Each has 2 retry attempts with 500ms delay
//   - Each times out after 3000ms
//
// This is NOT just execution semantics — it's part of the
// program description that gets hashed and verified.

console.log("\n--- AST: enrichUsers (bounded par_map) ---");
console.log(
  JSON.stringify(
    enrichUsers.ast,
    (k, v) => (k === "__id" ? undefined : v),
    2
  )
);

console.log("\n--- AST: fullEnrichment (nested composition) ---");
const simplified = JSON.stringify(
  fullEnrichment.ast,
  (k, v) => (k === "__id" || k === "config" ? undefined : v),
  2
);
console.log(simplified);

// ---- 10. Syntax comparison --------------------------------
console.log(`
========================================
SYNTAX COMPARISON: with and without fiber
========================================

Simple query (IDENTICAL — fiber is invisible):

  const user = $.sql\`select * from users where id = \${$.input.id}\`

Parallel queries:

  // without fiber — implicit, uncontrolled
  const users = $.sql\`select * from users\`
  const posts = $.sql\`select * from posts\`
  return { users, posts }

  // with fiber — explicit, verifiable
  return $.par(
    $.sql\`select * from users\`,
    $.sql\`select * from posts\`
  )

Bounded fan-out:

  // without fiber — impossible to express
  // with fiber — one line
  $.par(users, { concurrency: 5 }, (user) =>
    $.sql\`select * from posts where user_id = \${user.id}\`
  )

Transaction + parallel (COMPOSABLE):

  const data = $.par(readA, readB)    // parallel reads
  return $.sql.begin(sql => [         // sequential writes
    sql\`update ... set x = \${data[0]}\`,
    sql\`update ... set y = \${data[1]}\`,
  ])
`);
