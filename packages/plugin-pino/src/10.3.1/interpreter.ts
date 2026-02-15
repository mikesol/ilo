import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";

/**
 * Pino client interface consumed by the pino handler.
 *
 * Abstracts over the actual pino logger so handlers can be
 * tested with mock clients.
 */
export interface PinoClient {
  /** Write a log line at the given level with optional bindings and merge object. */
  log(
    level: string,
    bindings: Record<string, unknown>[],
    mergeObject?: Record<string, unknown>,
    msg?: string,
  ): Promise<void>;
}

/**
 * Generator-based interpreter fragment for pino plugin nodes.
 *
 * Yields `pino/log` effects for all 6 log levels. Each effect
 * contains the level, resolved bindings chain, optional merge
 * object, and optional message string.
 */
export const pinoInterpreter: InterpreterFragment = {
  pluginName: "pino",
  canHandle: (node) => node.kind.startsWith("pino/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    // All 6 levels follow the same pattern
    const msg =
      node.msg != null
        ? ((yield { type: "recurse", child: node.msg as ASTNode }) as string)
        : undefined;

    const mergeObject =
      node.mergeObject != null
        ? ((yield {
            type: "recurse",
            child: node.mergeObject as ASTNode,
          }) as Record<string, unknown>)
        : undefined;

    const bindingNodes = node.bindings as ASTNode[];
    const bindings: Record<string, unknown>[] = [];
    for (const b of bindingNodes) {
      bindings.push((yield { type: "recurse", child: b }) as Record<string, unknown>);
    }

    return yield {
      type: "pino/log",
      level: node.level as string,
      ...(msg !== undefined ? { msg } : {}),
      ...(mergeObject !== undefined ? { mergeObject } : {}),
      bindings,
    };
  },
};
