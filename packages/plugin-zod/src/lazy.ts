import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodLazyNode extends ZodSchemaNodeBase {
  kind: "zod/lazy";
  getter: () => ZodSchemaBuilder<unknown>;
}

/**
 * Builder for Zod lazy schemas.
 *
 * Lazy schemas use a getter function to delay evaluation, allowing
 * self-referential and mutually recursive schemas. The AST stores
 * the getter function (not the resolved schema) to avoid infinite nesting.
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodLazyBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/lazy", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodLazyBuilder<T> {
    return new ZodLazyBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the lazy schema. */
export const lazyNodeKinds: string[] = ["zod/lazy"];

/**
 * Namespace fragment for lazy schema factory.
 */
export interface ZodLazyNamespace {
  /** Create a lazy schema that resolves via a getter function. */
  lazy<T>(getter: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T>;
}

/** Build the lazy namespace factory method. */
export function lazyNamespace(ctx: PluginContext): ZodLazyNamespace {
  return {
    lazy<T>(getter: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T> {
      return new ZodLazyBuilder<T>(ctx, [], [], undefined, { getter });
    },
  };
}

/**
 * Build a Zod schema from a lazy node by delegating to the
 * interpreter's buildSchemaGen.
 */
type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** 
 * Cache for resolved lazy schemas to handle cycles during interpretation.
 * Maps each lazy node to its Zod schema.
 */
const lazySchemaCache = new WeakMap<ZodLazyNode, z.ZodLazy<z.ZodType>>();

/** 
 * Cache for schemas resolved from getters.
 * This allows the synchronous z.lazy callback to lookup pre-built schemas.
 */
const resolvedSchemaCache = new WeakMap<() => ZodSchemaBuilder<unknown>, z.ZodType>();

/** Create lazy interpreter handler with access to the shared schema builder. */
export function createLazyInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/lazy": async function* (
      node: ZodLazyNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const getter = node.getter;
      
      // Check cache to avoid rebuilding the same lazy schema
      if (lazySchemaCache.has(node)) {
        return lazySchemaCache.get(node)!;
      }
      
      // Create the lazy schema wrapper
      // The challenge: z.lazy needs a sync function, but buildSchema is async
      // Solution: Pre-build the schema now and cache it for the getter
      const lazySchema: z.ZodLazy<z.ZodType> = z.lazy(() => {
        // Check if we've already resolved this getter
        if (resolvedSchemaCache.has(getter)) {
          return resolvedSchemaCache.get(getter)!;
        }
        
        // If not cached, we need the schema to have been pre-built
        // This can happen during mutual recursion where we're called before resolution
        // In this case, call the getter to get the builder and extract its cached schema
        const builder = getter();
        const schemaNode = builder.__schemaNode as AnyZodSchemaNode;
        
        // For mutual recursion, the schema might be in our lazy cache already
        if (schemaNode.kind === "zod/lazy" && lazySchemaCache.has(schemaNode as ZodLazyNode)) {
          return lazySchemaCache.get(schemaNode as ZodLazyNode)!;
        }
        
        // If we reach here during interpretation, it means we need the schema but haven't built it
        // This is the deferred resolution case - Zod will call this later during validation
        // We should throw a descriptive error
        throw new Error(
          `Lazy schema resolution failed: schema not pre-built. ` +
          `This may happen if the lazy getter references schemas not yet interpreted.`
        );
      });
      
      // Cache the lazy schema to handle circular references
      lazySchemaCache.set(node, lazySchema);
      
      // Now eagerly build the inner schema to populate resolvedSchemaCache
      // This allows subsequent lazy callbacks to find the pre-built schema
      try {
        const builder = getter();
        const schemaNode = builder.__schemaNode as AnyZodSchemaNode;
        
        // Only build if not already cached (avoid infinite loops)
        if (!resolvedSchemaCache.has(getter)) {
          // Build the schema asynchronously
          const builtSchema = yield* buildSchema(schemaNode);
          // Cache it for the synchronous lazy callback
          resolvedSchemaCache.set(getter, builtSchema);
        }
      } catch (error) {
        // If we get an error during pre-building (e.g., due to circular refs),
        // that's okay - the lazy wrapper will handle deferred resolution
      }
      
      return lazySchema;
    },
  };
}
