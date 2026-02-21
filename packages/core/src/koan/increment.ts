/**
 * Koan-model content-address increment function (01).
 */

/**
 * Runtime mirror of base-26 increment used by koan IDs.
 * Examples: `a -> b`, `z -> aa`, `az -> ba`, `zz -> aaa`.
 */
export function incrementId(s: string): string {
  if (s.length === 0) {
    return "a";
  }
  const last = s[s.length - 1];
  const rest = s.slice(0, -1);
  if (last === "z") {
    return rest === "" ? "aa" : incrementId(rest) + "a";
  }
  return rest + String.fromCharCode(last.charCodeAt(0) + 1);
}
