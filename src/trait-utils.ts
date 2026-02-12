import type { ASTNode, TraitImpl } from "./core";

export function inferType(
  node: ASTNode,
  impls: TraitImpl[],
  schema?: Record<string, unknown>,
): string | null {
  if (node.kind === "core/literal") {
    if (node.value === null) return "null";
    return typeof node.value;
  }
  for (const impl of impls) {
    const firstNodeKind = Object.values(impl.nodeKinds)[0];
    if (!firstNodeKind) continue;
    const pluginPrefix = firstNodeKind.split("/")[0];
    if (node.kind.startsWith(`${pluginPrefix}/`)) return impl.type;
  }
  if (node.kind === "core/prop_access") {
    return resolveSchemaType(node, schema);
  }
  return null;
}

export function resolveSchemaType(node: ASTNode, schema?: Record<string, unknown>): string | null {
  if (!schema) return null;
  const path: string[] = [];
  let current = node;
  while (current.kind === "core/prop_access") {
    path.unshift(current.property as string);
    current = current.object as ASTNode;
  }
  if (current.kind !== "core/input") return null;
  let schemaNode: unknown = schema;
  for (const key of path) {
    if (typeof schemaNode === "object" && schemaNode !== null && key in schemaNode) {
      schemaNode = (schemaNode as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  if (typeof schemaNode === "string") return schemaNode;
  if (typeof schemaNode === "object" && schemaNode !== null && "__tag" in schemaNode) {
    return (schemaNode as { __tag: string }).__tag;
  }
  return null;
}
