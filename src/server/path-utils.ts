import { isAbsolute, relative } from "node:path";

/**
 * True if `resolvedPath` is `root` or a path inside `root` (no `..` escape).
 * Both arguments must be absolute (e.g. from `resolve()`).
 */
export function isResolvedPathInsideRoot(root: string, resolvedPath: string): boolean {
  const rel = relative(root, resolvedPath);
  if (rel === "") return true;
  return !rel.startsWith("..") && !isAbsolute(rel);
}
