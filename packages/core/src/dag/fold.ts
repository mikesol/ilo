/**
 * fold() — base trampoline evaluator for NExpr adjacency maps.
 *
 * Evaluates an NExpr DAG using async generator interpreters.
 * Each handler is an async generator that yields child indices
 * to request child values, then returns its own value.
 *
 * Features:
 * - Stack-safe: explicit stack, no recursion
 * - Memoizing: shared DAG nodes evaluate exactly once
 * - Short-circuit: handlers control which children are evaluated
 * - Volatile/taint: volatile nodes always re-evaluate, taint propagates
 */

import type { NExpr, RuntimeEntry } from "./00-expr";

// ─── Interpreter types ──────────────────────────────────────────────

/** Context provided to handlers during fold evaluation. */
export interface FoldContext {
  /** Current scope bindings (top of scope stack), or undefined if no scope active. */
  getScope(): Record<string, unknown> | undefined;
}

/** What a handler can yield: child index or scoped child request. */
export type FoldYield = number | { child: number; scope: Record<string, unknown> };

/** A handler evaluates a single node kind via an async generator. */
export type Handler = (
  entry: RuntimeEntry,
  ctx: FoldContext,
) => AsyncGenerator<FoldYield, unknown, unknown>;

/** Maps node kind strings to their handlers. */
export type Interpreter = Record<string, Handler>;

// ─── PluginDef ──────────────────────────────────────────────────────

/** Definition of a plugin that can provide a default interpreter. */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

// ─── defaults() ─────────────────────────────────────────────────────

/**
 * Compose interpreters from plugin definitions and optional overrides.
 *
 * For each plugin, uses the override if provided, otherwise falls back
 * to the plugin's defaultInterpreter. Throws if neither is available
 * and the plugin declares node kinds.
 */
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const composed: Interpreter = {};
  for (const plugin of plugins) {
    if (plugin.name in overrides) {
      Object.assign(composed, overrides[plugin.name]);
    } else if (plugin.defaultInterpreter) {
      Object.assign(composed, plugin.defaultInterpreter());
    } else if (plugin.nodeKinds.length === 0) {
      // no kinds to interpret
    } else {
      throw new Error(
        `Plugin "${plugin.name}" has no defaultInterpreter and no override`,
      );
    }
  }
  return composed;
}

// ─── Volatile kinds ─────────────────────────────────────────────────

/** Node kinds that always re-evaluate (never memoized). */
export const VOLATILE_KINDS: Set<string> = new Set([
  "core/lambda_param",
  "st/get",
]);

// ─── FoldOptions ────────────────────────────────────────────────────

/** Options for fold(). */
export interface FoldOptions {
  /** Set of node kinds that should always re-evaluate. Defaults to VOLATILE_KINDS. */
  volatileKinds?: Set<string>;
}

// ─── Frame: one activation on the evaluation stack ──────────────────

interface Frame {
  id: string;
  gen: AsyncGenerator<FoldYield, unknown, unknown>;
  pendingValue: unknown;
  pendingError: unknown;
  tainted: boolean;
  /** Scope stack depth when this frame was pushed (for cleanup on pop). */
  scopeDepthOnPush: number;
}

// ─── foldFrom() ─────────────────────────────────────────────────────

/**
 * Evaluate a sub-expression rooted at `rootId` within an adjacency map.
 *
 * Creates an independent trampoline with its own memo and tainted sets.
 * Used by fiber handlers to spawn parallel evaluations of sub-DAGs
 * that share the same (read-only) adjacency map.
 *
 * Each handler yields child indices to request their evaluated values,
 * then returns its own result. The trampoline drives the generators
 * using an explicit stack, making it stack-safe for arbitrarily deep
 * DAGs. Shared nodes are memoized and evaluated exactly once per call.
 *
 * Volatile nodes (kinds in volatileKinds) always re-evaluate.
 * Taint propagates transitively: any node depending on a volatile
 * or tainted child is itself tainted and will re-evaluate.
 */
export async function foldFrom<T>(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
  options?: FoldOptions,
): Promise<T> {
  const memo: Record<string, unknown> = {};
  const tainted: Set<string> = new Set();
  const volatile = options?.volatileKinds ?? VOLATILE_KINDS;
  const stack: Frame[] = [];
  const scopeStack: Array<Record<string, unknown>> = [];

  const ctx: FoldContext = {
    getScope() {
      return scopeStack.length > 0
        ? scopeStack[scopeStack.length - 1]
        : undefined;
    },
  };

  function isVolatile(id: string): boolean {
    const entry = adj[id];
    return entry !== undefined && volatile.has(entry.kind);
  }

  function pushNode(id: string, scopeDepth?: number): void {
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);
    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({
      id,
      gen: handler(entry, ctx),
      pendingValue: undefined,
      pendingError: undefined,
      tainted: false,
      scopeDepthOnPush: scopeDepth ?? scopeStack.length,
    });
  }

  pushNode(rootId);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    // If node is already memoized AND not volatile/tainted, skip
    if (frame.id in memo && !isVolatile(frame.id) && !tainted.has(frame.id)) {
      stack.pop();
      continue;
    }

    let iterResult: IteratorResult<FoldYield, unknown>;
    try {
      if (frame.pendingError !== undefined) {
        const err = frame.pendingError;
        frame.pendingError = undefined;
        iterResult = await frame.gen.throw(err);
      } else {
        iterResult = await frame.gen.next(frame.pendingValue);
      }
    } catch (err) {
      // Handler threw (uncaught) — propagate up
      stack.pop();
      // Restore scope stack to frame's depth
      scopeStack.length = frame.scopeDepthOnPush;
      if (stack.length > 0) {
        stack[stack.length - 1].pendingError = err;
      } else {
        throw err;
      }
      continue;
    }

    if (iterResult.done) {
      memo[frame.id] = iterResult.value;
      // Track taint: volatile nodes and nodes depending on them
      if (frame.tainted || isVolatile(frame.id)) {
        tainted.add(frame.id);
      }
      stack.pop();
      // Restore scope stack to frame's depth
      scopeStack.length = frame.scopeDepthOnPush;
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.pendingValue = iterResult.value;
        // Propagate taint to parent
        if (tainted.has(frame.id)) {
          parent.tainted = true;
        }
      }
      continue;
    }

    // Parse yield value: number or { child, scope }
    const yieldVal = iterResult.value;
    let childIndex: number;
    let scopeBinding: Record<string, unknown> | undefined;
    if (typeof yieldVal === "number") {
      childIndex = yieldVal;
    } else {
      childIndex = yieldVal.child;
      scopeBinding = yieldVal.scope;
    }

    const entry = adj[frame.id];
    const childId = entry.children[childIndex];
    if (childId === undefined) {
      throw new Error(
        `fold: node "${frame.id}" (${entry.kind}) has no child at index ${childIndex}`,
      );
    }

    // Push scope if this is a scoped yield
    if (scopeBinding !== undefined) {
      scopeStack.push(scopeBinding);
    }

    // If child is volatile or tainted, always re-evaluate
    if (isVolatile(childId) || tainted.has(childId)) {
      delete memo[childId];
      pushNode(childId);
      continue;
    }

    if (childId in memo) {
      frame.pendingValue = memo[childId];
      // If we pushed a scope for a cached child, pop it immediately
      if (scopeBinding !== undefined) {
        scopeStack.pop();
      }
      continue;
    }

    pushNode(childId);
  }

  if (!(rootId in memo)) {
    throw new Error(`fold: root "${rootId}" was not evaluated`);
  }
  return memo[rootId] as T;
}

// ─── fold() ─────────────────────────────────────────────────────────

/**
 * Evaluate an NExpr DAG using an async-generator interpreter.
 *
 * Delegates to {@link foldFrom} with the expression's root ID and
 * adjacency map. See foldFrom for full implementation details.
 */
export async function fold<O>(
  expr: NExpr<O, string, unknown, string>,
  interp: Interpreter,
  options?: FoldOptions,
): Promise<O> {
  return foldFrom<O>(expr.__id, expr.__adj, interp, options);
}
