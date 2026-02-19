/**
 * Koan 15: Bridge — toDAG/toAST + foldAST integration
 *
 * RULE: Never rewrite this file.
 *
 * What we prove:
 * - toDAG(ast) flattens a tree AST into { rootId, entries: Record<id, DagEntry> }
 * - DagEntry preserves named fields (left, right, values, etc.) as child ID refs
 * - toAST(rootId, entries) reconstructs the tree with correct field names
 * - Round-trip: app → toDAG → toAST → foldAST produces correct results
 * - Transform then fold: swap add→mul, constant fold, etc.
 * - String programs round-trip correctly
 * - defaults(app) works unchanged on transformed trees
 *
 * NOTE: This koan uses core package imports (mvfm, foldAST, defaults, num, str, semiring).
 * Use `npx tsx` only — do NOT run tsc on this file directly.
 * Core imports use monorepo path aliases that only resolve through the project build.
 *
 * Imports: 14-dagql (re-exports chain)
 *
 * Gate:
 *   npx tsx spike-koans/15-bridge.ts
 */

export * from "./14-dagql";
