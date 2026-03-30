import { join, resolve } from "node:path";
import { isResolvedPathInsideRoot } from "./path-utils.ts";

/**
 * Attempt to serve a static file from `publicDir`.
 * Returns `null` if the file doesn't exist (caller should continue routing).
 */
export async function serveStatic(
  publicDir: string,
  pathname: string,
): Promise<Response | null> {
  const root = resolve(publicDir);
  const filePath = resolve(join(root, pathname));
  if (!isResolvedPathInsideRoot(root, filePath)) return null;

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  // Bun.file() on a directory returns a file that exists but has no body;
  // reject paths that look like directories.
  if (filePath.endsWith("/")) return null;

  return new Response(file, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
