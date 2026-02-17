export interface NodeExample {
  /** One-line description shown below the heading. */
  description: string;
  /** Executable code for the playground. */
  code: string;
  /** Plugin packages to import beyond core+console. Defaults to none. */
  plugins?: string[];
  /** JS expression returning an interpreter record for infra plugins. */
  mockInterpreter?: string;
  /** When set, the playground loads PGLite and seeds it with this SQL. */
  pglite?: { seedSQL: string };
}
