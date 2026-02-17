/**
 * Compile-time tests: foldAST enforces K-unification between Interpreter and Program.
 * An interpreter must cover at least every kind the program uses.
 */

import { foldAST, type Interpreter } from "../fold";
import type { Program } from "../types";

declare const numInterp: Interpreter<"num/add" | "num/sub">;
declare const numProg: Program<"num/add" | "num/sub">;
declare const strProg: Program<"str/upper">;
declare const wideInterp: Interpreter<"num/add" | "num/sub" | "str/upper">;
declare const wideProg: Program<"num/add" | "num/sub" | "str/upper">;
declare const narrowInterp: Interpreter<"num/add">;
declare const narrowProg: Program<"num/add">;

// --- Positive: exact match ---
foldAST(numInterp, numProg);

// --- Positive: interpreter covers more kinds than program uses ---
foldAST(wideInterp, narrowProg);

// --- Negative: disjoint kinds ---
// @ts-expect-error interpreter lacks "str/upper"
foldAST(numInterp, strProg);

// --- Negative: narrow interpreter, wide program ---
// @ts-expect-error interpreter lacks "num/sub" and "str/upper"
foldAST(narrowInterp, wideProg);
