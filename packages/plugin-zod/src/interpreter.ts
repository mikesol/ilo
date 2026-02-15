import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import { z } from "zod";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  // ASTNode error config — would need interpreter context to evaluate.
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodString {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number, errOpt);
        break;
      case "max_length":
        s = s.max(check.value as number, errOpt);
        break;
      // Additional string checks will be added by #137
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Yields recurse effects for value-carrying wrappers (default, prefault, catch).
 * Simple schema types and non-value wrappers are handled synchronously.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  switch (node.kind) {
    case "zod/string": {
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const base = errorFn ? z.string({ error: errorFn }) : z.string();
      return applyStringChecks(base, checks);
    }

    // Simple wrappers (no value field)
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner as ASTNode) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner as ASTNode)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner as ASTNode)).brand(node.brand as string);

    // Value-carrying wrappers — evaluate the value AST node via recurse
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.catch(value);
    }

    // Transform/pipe/preprocess (#155)
    case "zod/transform": {
      if (node.inner) {
        // Wrapper transform (from .transform(fn) chain) — build inner, transform applied post-validation
        return yield* buildSchemaGen(node.inner as ASTNode);
      }
      // Standalone transform ($.zod.transform(fn)) — accepts any input
      return z.any();
    }
    case "zod/pipe": {
      const source = yield* buildSchemaGen(node.inner as ASTNode);
      const target = yield* buildSchemaGen(node.target as ASTNode);
      return source.pipe(target);
    }
    case "zod/preprocess": {
      // Build inner schema; preprocessing handled in parse operations
      return yield* buildSchemaGen(node.inner as ASTNode);
    }

    // Additional schema types will be added by colocated interpreter issues
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 * In Zod v4, parse-level errors must be functions.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 * Refinements live on the base schema node, not on wrappers.
 */
function extractRefinements(schemaNode: ASTNode): RefinementDescriptor[] {
  return (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
}

/**
 * Evaluate a single lambda AST node with the given input value.
 * Clones the body, injects the value into the lambda param, and recurses.
 */
function* evaluateLambda(
  value: unknown,
  lambda: { param: { name: string }; body: ASTNode },
): Generator<StepEffect, unknown, unknown> {
  const bodyClone = structuredClone(lambda.body);
  injectLambdaParam(bodyClone, lambda.param.name, value);
  return yield { type: "recurse", child: bodyClone };
}

/**
 * Collect transform lambdas from the schema wrapper chain.
 * Returns lambdas in execution order (innermost first).
 */
function collectTransformLambdas(node: ASTNode): Array<{ param: { name: string }; body: ASTNode }> {
  const transforms: Array<{ param: { name: string }; body: ASTNode }> = [];
  let current = node;
  // Walk through wrapper transforms
  while (current.kind === "zod/transform" && current.inner) {
    transforms.unshift(current.fn as any);
    current = current.inner as ASTNode;
  }
  // Standalone transform (no inner)
  if (current.kind === "zod/transform" && !current.inner && current.fn) {
    transforms.unshift(current.fn as any);
  }
  return transforms;
}

/**
 * Extract preprocess lambda if the schema chain contains a preprocess wrapper.
 * Walks through transform wrappers to find preprocess underneath.
 */
function extractPreprocessLambda(
  node: ASTNode,
): { param: { name: string }; body: ASTNode } | undefined {
  let current = node;
  while (current.kind === "zod/transform" && current.inner) {
    current = current.inner as ASTNode;
  }
  if (current.kind === "zod/preprocess") {
    return current.fn as any;
  }
  return undefined;
}

/**
 * Apply refinement descriptors to a validated value via the generator pipeline.
 * Each refinement's lambda body is cloned, injected with the current value,
 * and evaluated through the interpreter via recurse effects.
 *
 * - `refine` / `check`: predicate must return truthy, else throw
 * - `overwrite`: result replaces the current value
 * - `super_refine`: evaluated for side effects (e.g. adding issues)
 */
function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): Generator<StepEffect, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { name: string }; body: ASTNode };
    const bodyClone = structuredClone(lambda.body);
    injectLambdaParam(bodyClone, lambda.param.name, current);
    const result = yield { type: "recurse", child: bodyClone };

    switch (ref.kind) {
      case "refine":
      case "check":
        if (!result) {
          throw new Error(typeof ref.error === "string" ? ref.error : "Refinement failed");
        }
        break;
      case "overwrite":
        current = result;
        break;
      case "super_refine":
        // Evaluated for side effects; return value ignored
        break;
    }
  }
  return current;
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * Schema nodes (zod/string, etc.) are handled by `buildSchemaGen` which
 * constructs actual Zod schemas from AST descriptors, yielding recurse
 * effects for value-carrying wrappers.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        let value = schema.parse(input, parseErrorOpt(node));
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        let value = result.data;
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(value, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return transforms.length > 0 ? { success: true, data: value } : result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        let value = schema.parse(input, parseErrorOpt(node));
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        let value = result.data;
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(value, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return transforms.length > 0 ? { success: true, data: value } : result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
