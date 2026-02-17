# Design: Plugin Namespace Index Pages (#256)

## Problem

The docs site has individual pages for each node kind (e.g., `/core/begin`, `/postgres/query`) but no landing pages for plugin namespaces (e.g., `/core`, `/postgres`). Users have no introduction to what each plugin does before diving into specific node kinds.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Content format | HTML strings in TS objects | Matches existing data-driven pattern, no new dependency |
| Data model | Union type in same registry | Minimal changes, single `getAllExamples()` call |
| File location | Dedicated `indexes.ts` | Keeps existing files as pure `NodeExample`, easy to find all index content |
| Front page styling | `text-base-400` for index links | Subtle distinction from `text-base-500` node-kind links |
| Code examples | Astro `<Code>` component (Shiki) | Reuses existing fallback rendering, consistent syntax highlighting |
| Markdown rendering | Raw HTML in `content` field, rendered via `set:html` | No dependency added |

## Data Model

### New types in `src/examples/types.ts`

```typescript
export interface NamespaceIndex {
  /** Prose content as raw HTML. */
  content: string;
  /** Optional non-runnable code example (rendered with Shiki Code component). */
  staticCode?: string;
}

export type ExampleEntry = NodeExample | NamespaceIndex;

export function isNamespaceIndex(entry: ExampleEntry): entry is NamespaceIndex {
  return "content" in entry && !("code" in entry);
}
```

### Index content in `src/examples/indexes.ts`

Single file exporting `Record<string, NamespaceIndex>` with 13 entries keyed by bare namespace name:

- **`core`** — Framework introduction: `mvfm()`, `prelude`, `defaults()`, `foldAST()`, `injectInput()`
- **`postgres`** — No defaultInterpreter, `serverInterpreter(client, baseInterpreter)` construction, non-runnable `staticCode` example, playground note about `wasmPgInterpreter`
- **`num`**, **`str`**, **`boolean`**, **`eq`**, **`ord`** — Brief pure-logic plugin descriptions; `defaults()` just works
- **`st`** — State management (let/get/set/push); interpreter included in defaults
- **`control`** — Control flow (each/while); pure logic
- **`error`** — Error handling (try/fail/attempt); pure logic
- **`fiber`** — Concurrency semantics; interpreter included in defaults
- **`console`** — Console output; needs a console object, `createConsoleInterpreter(fakeConsole)`
- **`zod`** — Schema validation; needs `createZodInterpreter()`

### Aggregation in `src/examples/index.ts`

```typescript
import indexes from "./indexes";
// ...
const modules: Record<string, ExampleEntry>[] = [
  // existing modules...
  indexes,
];

export function getAllExamples(): Record<string, ExampleEntry> {
  return Object.assign({}, ...modules);
}
```

## Rendering

### `src/pages/[...slug].astro`

Branch on entry type:

- **NamespaceIndex**: Render `content` via `set:html`, render `staticCode` with `<Code>` component (same theme as existing fallback). No Playground component.
- **NodeExample**: Existing rendering unchanged.

### `src/pages/index.astro`

- Import `isNamespaceIndex` and `getAllExamples`
- Build the full entries map to check each key's type
- Index page links: `text-base-400 hover:text-base-50`
- Node-kind links: `text-base-500 hover:text-base-50` (unchanged)
- Sort order unchanged (alphabetical, core first) — bare namespace keys naturally sort before their `namespace/kind` children

## Files Touched

1. `src/examples/types.ts` — Add `NamespaceIndex`, `ExampleEntry`, `isNamespaceIndex()`
2. `src/examples/indexes.ts` — New file with 13 namespace index entries
3. `src/examples/index.ts` — Import indexes, update return type
4. `src/pages/[...slug].astro` — Branch rendering for index vs example pages
5. `src/pages/index.astro` — Differentiate link colors for index pages

## Not In Scope

- Changing front page layout
- Navigation between index and node-kind pages
- Restructuring URL scheme
