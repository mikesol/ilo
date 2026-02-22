import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { createFoldState, fold } from "@mvfm/core";
import { createPostgresInterpreter, type PostgresClient } from "./interpreter";

/** Marker for SQL fragment results from identifier/insert/set helpers. */
interface PgFragment {
  __pgFragment: true;
  sql: string;
  params: unknown[];
}

function isPgFragment(v: unknown): v is PgFragment {
  return typeof v === "object" && v !== null && (v as PgFragment).__pgFragment === true;
}

/**
 * Build parameterized SQL from evaluated children of a postgres/query node.
 */
function buildQuerySQL(
  strings: string[],
  paramValues: unknown[],
): { sql: string; params: unknown[] } {
  let sql = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramValues.length) {
      const val = paramValues[i];
      if (isPgFragment(val)) {
        sql += val.sql;
        params.push(...val.params);
      } else {
        params.push(val);
        sql += `$${params.length}`;
      }
    }
  }
  return { sql, params };
}

/**
 * Creates a full server-side interpreter for `postgres/*` node kinds,
 * including transaction, savepoint, and cursor support.
 *
 * Unlike `createPostgresInterpreter`, this handles `begin`, `savepoint`,
 * and `cursor` nodes by spawning nested `fold()` evaluations with fresh
 * or modified interpreters.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param adj - The adjacency map from the normalized expression.
 * @param baseInterp - Base interpreter for all non-postgres node kinds.
 * @returns An Interpreter for all postgres node kinds.
 */
export function createPostgresServerInterpreter(
  client: PostgresClient,
  adj: Record<string, RuntimeEntry>,
  baseInterp: Interpreter,
): Interpreter {
  const base = createPostgresInterpreter(client);

  function makeFullInterp(txClient: PostgresClient): Interpreter {
    return {
      ...baseInterp,
      ...createPostgresServerInterpreter(txClient, adj, baseInterp),
    };
  }

  return {
    ...base,

    "postgres/begin": async function* (entry: RuntimeEntry) {
      const mode = (yield 0) as string;

      return await client.begin(async (tx) => {
        const txInterp = makeFullInterp(tx);
        if (mode === "pipeline") {
          const results: unknown[] = [];
          for (let i = 1; i < entry.children.length; i++) {
            results.push(await fold(entry.children[i], adj, txInterp));
          }
          return results;
        }
        return await fold(entry.children[1], adj, txInterp);
      });
    },

    "postgres/savepoint": async function* (entry: RuntimeEntry) {
      const mode = (yield 0) as string;

      return await client.savepoint(async (tx) => {
        const txInterp = makeFullInterp(tx);
        if (mode === "pipeline") {
          const results: unknown[] = [];
          for (let i = 1; i < entry.children.length; i++) {
            results.push(await fold(entry.children[i], adj, txInterp));
          }
          return results;
        }
        return await fold(entry.children[1], adj, txInterp);
      });
    },

    "postgres/cursor": async function* (entry: RuntimeEntry) {
      // Children: [queryExpr, batchSizeExpr, bodyExpr]
      // Evaluate query inline to get SQL
      const queryEntry = adj[entry.children[0]];
      const _numStrings = queryEntry.out as number | undefined;

      // We need to evaluate the query's children to build SQL.
      // But we can't yield into the query's subtree directly —
      // we fold it and extract SQL from the result.
      //
      // Actually, the simplest approach: yield child 0 to evaluate
      // the query normally (which executes it!). But for cursors,
      // we need the raw SQL, not the executed result.
      //
      // Solution: Build SQL by folding the query's string/param children
      // directly, then use cursor API with the raw SQL.

      // Evaluate batchSize
      const batchSize = (yield 1) as number;

      // Build SQL from query children. The query node's children are:
      // [numStrings, ...stringParts, ...paramExprs]
      const qChildren = queryEntry.children;
      const fullInterp = makeFullInterp(client);

      // Evaluate numStrings
      const qNumStrings = (await fold(qChildren[0], adj, fullInterp)) as number;
      const strings: string[] = [];
      for (let i = 0; i < qNumStrings; i++) {
        strings.push((await fold(qChildren[1 + i], adj, fullInterp)) as string);
      }
      const paramValues: unknown[] = [];
      for (let i = 1 + qNumStrings; i < qChildren.length; i++) {
        paramValues.push(await fold(qChildren[i], adj, fullInterp));
      }
      const { sql, params } = buildQuerySQL(strings, paramValues);

      // Set up cursor iteration with fresh state per batch
      const batchCell: { current: unknown[] } = { current: [] };

      const cursorInterp: Interpreter = {
        ...fullInterp,
        "postgres/cursor_batch": async function* () {
          return batchCell.current;
        },
      };

      const bodyId = entry.children[2];

      await client.cursor(sql, params, batchSize, async (rows) => {
        batchCell.current = rows;
        // Fresh state per iteration so body is re-evaluated with new batch
        await fold(bodyId, adj, cursorInterp, createFoldState());
        return undefined;
      });

      return undefined;
    },
  };
}
