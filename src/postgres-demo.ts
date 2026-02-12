// ============================================================
// Side-by-side: Real postgres.js vs Ilo
// ============================================================

import { ilo } from "./core";
import { num, str } from "./plugins";
import { postgres } from "./postgres-plugin";

const app = ilo(num, str, postgres("postgres://localhost/myapp"));

// ---- 1. Basic query (nearly identical) --------------------
//
// REAL postgres.js:
//   const users = await sql`
//     select * from users where age > ${age}
//   `
//
// ILO:
const getOlderUsers = app(($) => {
  return $.sql`
    select * from users where age > ${$.input.age}
  `;
});
console.log("✓ Basic query");

// ---- 2. Query with dependency chain -----------------------
//
// REAL:
//   const [user] = await sql`select * from users where id = ${id}`
//   const posts = await sql`select * from posts where user_id = ${user.id}`
//
// ILO:
const getUserWithPosts = app(($) => {
  const user = $.sql`select * from users where id = ${$.input.id}`;
  const posts = $.sql`select * from posts where user_id = ${user[0].id}`;

  return {
    user: user[0],
    posts,
  };
});
console.log("✓ Query with dependency chain");

// ---- 3. Insert with returning -----------------------------
//
// REAL:
//   const [user] = await sql`
//     insert into users (name, age) values (${name}, ${age}) returning *
//   `
//
// ILO:
const createUser = app(($) => {
  const user = $.sql`
    insert into users (name, age)
    values (${$.input.name}, ${$.input.age})
    returning *
  `;
  return user[0];
});
console.log("✓ Insert with returning");

// ---- 4. Dynamic insert helper -----------------------------
//
// REAL:
//   await sql`insert into users ${sql(user, 'name', 'age')}`
//
// ILO:
const createUserDynamic = app(($) => {
  return $.sql`insert into users ${$.sql.insert($.input.user, ["name", "age"])} returning *`;
});
console.log("✓ Dynamic insert helper");

// ---- 5. Transaction (pipeline mode) -----------------------
//
// REAL:
//   await sql.begin(sql => [
//     sql`update users set active = false where id = ${id}`,
//     sql`insert into audit_log (action, user_id) values ('deactivate', ${id})`,
//   ])
//
// ILO (identical!):
const deactivateUser = app(($) => {
  return $.sql.begin((sql) => [
    sql`update users set active = false where id = ${$.input.id}`,
    sql`insert into audit_log (action, user_id) values ('deactivate', ${$.input.id})`,
  ]);
});
console.log("✓ Transaction pipeline (identical to postgres.js!)");

// ---- 6. Transaction with data dependency ------------------
//
// REAL:
//   const [user, account] = await sql.begin(async sql => {
//     const [user] = await sql`insert into users (name) values ('Murray') returning *`
//     const [account] = await sql`insert into accounts (user_id) values (${user.user_id}) returning *`
//     return [user, account]
//   })
//
// ILO:
const createUserAndAccount = app(($) => {
  return $.sql.begin((sql) => {
    const user = sql`insert into users (name) values (${$.input.name}) returning *`;
    const account = sql`insert into accounts (user_id) values (${user[0].user_id}) returning *`;
    // $.do sequences the effects; last arg is the return value
    return $.do(user, account, { user: user[0], account: account[0] });
  });
});
console.log("✓ Transaction with dependency");

// ---- 7. Dynamic column selection --------------------------
//
// REAL:
//   const columns = ['name', 'age']
//   await sql`select ${sql(columns)} from users`
//
// ILO:
const selectColumns = app(($) => {
  return $.sql`select ${$.sql.id("name")}, ${$.sql.id("age")} from users`;
});
console.log("✓ Dynamic identifiers");

// ---- 8. Update with set helper ----------------------------
//
// REAL:
//   await sql`update users set ${sql(user, 'name', 'age')} where id = ${id}`
//
// ILO:
const updateUser = app(($) => {
  return $.sql`update users set ${$.sql.set($.input.data, ["name", "age"])} where id = ${$.input.id}`;
});
console.log("✓ Dynamic update helper");

// ---- 9. Query + transform (map/filter) --------------------
//
// REAL:
//   const users = await sql`select * from users`
//   const names = users.map(u => u.name.toUpperCase())
//
// ILO:
const getUserNames = app(($) => {
  const users = $.sql`select * from users`;
  return users.map((u: any) => $.upper(u.name));
});
console.log("✓ Query + transform");

// ---- 10. Conditional + transaction ------------------------
//
// REAL:
//   await sql.begin(async sql => {
//     const [user] = await sql`select * from users where id = ${id}`
//     if (user.is_admin) {
//       await sql`insert into admin_log (user_id) values (${user.id})`
//     }
//     return user
//   })
//
// ILO:
const getUserWithAudit = app(($) => {
  return $.sql.begin((sql) => {
    const user = sql`select * from users where id = ${$.input.id}`;
    const auditLog = sql`insert into admin_log (user_id) values (${user[0].id})`;

    return $.cond($.eq(user[0].is_admin, true))
      .t($.do(auditLog, user[0]))
      .f(user[0]);
  });
});
console.log("✓ Conditional transaction (requires $.cond)");

// ---- Print some ASTs --------------------------------------

console.log("\n--- AST: deactivateUser (pipeline transaction) ---");
console.log(JSON.stringify(deactivateUser.ast, (k, v) => k === "__id" ? undefined : v, 2));

console.log("\n--- AST: createUserAndAccount (dependency transaction) ---");
console.log(JSON.stringify(createUserAndAccount.ast, (k, v) => k === "__id" ? undefined : v, 2));

// ---- Summary ----------------------------------------------
console.log(`
========================================
SCORECARD: postgres.js API compatibility
========================================

✅ Near-identical:
   sql\`...\`                     tagged template queries
   sql\`... \${param}\`           parameterized queries
   sql.begin(sql => [...])       pipeline transactions
   insert/update with returning  just works

⚠️  Slightly different:
   sql('identifier')          →  $.sql.id('identifier')
   sql(obj, ...cols)          →  $.sql.insert(obj, cols)
   const [row] = await sql... →  const row = $.sql\`...\`[0]
   sql.begin(async sql => {   →  $.sql.begin(sql => {
     await sql\`...\`                sql\`...\`   // no await
   })                            })

❌ Can't model:
   Cursors / streaming          (inherently async)
   .catch() error handling      (interpreter concern)
   COPY TO/FROM                 (streaming)
   LISTEN/NOTIFY                (persistent connection)
`);
