import { defaults, foldAST } from "../../../src/index";
import type { Program } from "../../../src/index";

export async function runWithDefaults(app: { plugins: readonly unknown[] }, program: Program<unknown>) {
  return await foldAST(defaults(app as never), program as never);
}
