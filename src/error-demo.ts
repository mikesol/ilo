// ============================================================
// The full stack: core → fiber → error → postgres
// ============================================================
//
// The monad stack that doesn't feel like a monad stack.
// No lift. No runExceptT. No liftAff. Just combinators
// that compose because they all operate on Expr<T>.
//
// ============================================================

import { ilo } from "./core";
import { num, str } from "./plugins";
import { postgres } from "./postgres-plugin";
import { fiber } from "./fiber-plugin";
import { error } from "./error-plugin";

const app = ilo(num, str, postgres("postgres://localhost/myapp"), fiber, error);

// ---- 1. Simple try/catch ---------------------------------
//
// Most basic error handling. Query might fail; provide fallback.

const safeGetUser = app(($) => {
  return $.try(
    $.sql`select * from users where id = ${$.input.id}`
  ).catch((err) => ({
    error: err.message,
    user: null,
  }));
});
console.log("✓ Simple try/catch");

// ---- 2. orElse sugar -------------------------------------
//
// When you just want a default value on failure.

const getUserOrDefault = app(($) => {
  return $.orElse(
    $.sql`select * from users where id = ${$.input.id}`,
    [{ name: "anonymous", id: 0 }]
  );
});
console.log("✓ orElse sugar");

// ---- 3. guard — assertions in the program ----------------
//
// "Check this condition, fail if false"
// Guards compose naturally with $.do()

const transfer = app(($) => {
  const from = $.sql`select * from accounts where id = ${$.input.fromId}`;
  const amount = $.input.amount;

  return $.do(
    $.guard($.gt(from[0].balance, amount), {
      code: 400,
      message: "insufficient funds",
    }),
    $.sql`update accounts set balance = balance - ${amount} where id = ${$.input.fromId}`,
    $.sql`update accounts set balance = balance + ${amount} where id = ${$.input.toId}`,
    { success: true, newBalance: $.sub(from[0].balance, amount) }
  );
});
console.log("✓ guard + do chain");

// ---- 4. try + match — pattern match on error types -------
//
// Different recovery strategies for different errors.

const resilientLookup = app(($) => {
  return $.try(
    $.sql`select * from users where id = ${$.input.id}`
  ).match({
    not_found: (_err) => ({ user: null, source: "none" }),
    timeout: (_err) => ({ user: null, source: "cache_timeout" }),
    _: (err) => $.fail(err), // re-throw anything else
  });
});
console.log("✓ try/match on error types");

// ---- 5. attempt — Either-style ---------------------------
//
// When you want to inspect success/failure as data.

const checkUser = app(($) => {
  const result = $.attempt(
    $.sql`select * from users where id = ${$.input.id}`
  );

  return $.cond($.eq(result.err, null))
    .t({ found: true, user: result.ok })
    .f({ found: false, error: result.err });
});
console.log("✓ attempt (Either-style)");

// ---- 6. error + fiber composition ------------------------
//
// Each parallel branch handles its own errors.
// No error in one branch kills the others.

const multiSourceDashboard = app(($) => {
  return $.par(
    $.orElse($.sql`select count(*) from users`, [{ count: -1 }]),
    $.orElse($.sql`select count(*) from posts`, [{ count: -1 }]),
    $.orElse($.sql`select count(*) from comments`, [{ count: -1 }])
  );
});
console.log("✓ par + orElse (independent error handling)");

// ---- 7. settle — Promise.allSettled -----------------------
//
// Collect all results, don't fail fast.

const healthCheck = app(($) => {
  return $.settle(
    $.sql`select 1 from users limit 1`,
    $.sql`select 1 from posts limit 1`,
    $.sql`select 1 from comments limit 1`
  );
  // result.fulfilled = successful checks
  // result.rejected  = failed checks
});
console.log("✓ settle (allSettled)");

// ---- 8. The full monty: fiber + error + postgres ----------
//
// "For each user (5 at a time), try to enrich with posts.
//  On failure, retry twice. On persistent failure, return
//  empty posts. Guard that we have at least 1 user."

const fullStack = app(($) => {
  const users = $.sql`select * from users where active = true`;

  return $.do(
    $.guard($.gt(users.length, 0), {
      code: 404,
      message: "no active users",
    }),
    $.par(users, { concurrency: 5 }, (user) =>
      $.try(
        $.retry(
          $.sql`select * from posts where user_id = ${user.id}`,
          { attempts: 2, delay: 500 }
        )
      ).catch((_err) => [])
    )
  );
});
console.log("✓ Full stack: guard → par(5) → try → retry(2) → catch");

// ---- 9. Transaction with error handling -------------------
//
// This is where the layers really shine.
// "Transfer money, but validate first, and if anything
//  in the transaction fails, return a structured error."

const safeTransfer = app(($) => {
  return $.try(
    $.sql.begin((sql) => {
      const from = sql`select * from accounts where id = ${$.input.fromId} for update`;
      const to = sql`select * from accounts where id = ${$.input.toId} for update`;

      return $.do(
        $.guard($.gt(from[0].balance, $.input.amount), {
          code: "INSUFFICIENT_FUNDS",
        }),
        sql`update accounts set balance = balance - ${$.input.amount} where id = ${$.input.fromId}`,
        sql`update accounts set balance = balance + ${$.input.amount} where id = ${$.input.toId}`,
        {
          success: true,
          fromBalance: $.sub(from[0].balance, $.input.amount),
          toBalance: $.add(to[0].balance, $.input.amount),
        }
      );
    })
  ).catch((err) => ({
    success: false,
    error: err,
  }));
});
console.log("✓ try → begin → guard + do → catch");

// ---- 10. try with finally --------------------------------
//
// Cleanup that runs regardless of success or failure.

const withAuditLog = app(($) => {
  return $.try(
    $.sql`delete from users where id = ${$.input.id}`
  )
    .finally(
      $.sql`insert into audit_log (action, target_id, timestamp)
            values ('delete_user', ${$.input.id}, now())`
    )
    .catch((err) => ({ deleted: false, error: err.message }));
});
console.log("✓ try/finally/catch");

// ---- Print the safeTransfer AST ---------------------------

console.log("\n--- AST: safeTransfer (full composition) ---");
console.log(
  JSON.stringify(
    safeTransfer.ast,
    (k, v) => (k === "__id" || k === "config" ? undefined : v),
    2
  )
);

// ---- Summary ----------------------------------------------
console.log(`
=============================================
THE MONAD STACK (that doesn't feel like one)
=============================================

Layer       Plugin     Provides           PureScript equivalent
─────       ──────     ────────           ─────────────────────
pure        core       $.do, $.cond       Identity
concurrency fiber      $.par, $.retry     Aff
failure     error      $.try, $.guard     ExceptT
database    postgres   $.sql\`...\`         a postgres FFI
http        (future)   $.fetch\`...\`       an http FFI

ALL composable. NONE depend on each other.

Developer sees:
  $.try(
    $.par(users, { concurrency: 5 }, user =>
      $.retry(
        $.sql\`select * from posts where user_id = \${user.id}\`,
        { attempts: 2, delay: 500 }
      )
    )
  ).catch(err => [])

PureScript equivalent:
  runExceptT $ do
    users <- lift $ liftAff $ query "select ..."
    lift $ liftAff $ parTraverse 5 users \\user ->
      retry (Attempts 2) (Delay 500) $
        liftAff $ query "select ... where user_id = ?"
    \`catchError\` \\_ -> pure []

Same program. One has lift/liftAff/runExceptT.
The other has proxies.
`);
