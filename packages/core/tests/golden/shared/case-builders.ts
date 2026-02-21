import { mvfm, num, semiring, str, eq } from "../../../src/index";

export function buildMathApp() {
  return mvfm(num, semiring);
}

export function buildTextEqApp() {
  return mvfm(str, eq);
}
