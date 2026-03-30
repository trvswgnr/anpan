import { isAbsolute, join, relative } from "node:path";

/**
 * Resolve a user-supplied path: absolute POSIX paths are returned as-is;
 * otherwise resolved relative to `process.cwd()`.
 */
export function resolveProjectPath(path: string): string {
  if (path.startsWith("/")) return path;
  return join(process.cwd(), path);
}

/**
 * True if `resolvedPath` is `root` or a path inside `root` (no `..` escape).
 * Both arguments must be absolute (e.g. from `resolve()`).
 */
export function isResolvedPathInsideRoot(root: string, resolvedPath: string): boolean {
  const rel = relative(root, resolvedPath);
  if (rel === "") return true;
  return !rel.startsWith("..") && !isAbsolute(rel);
}
