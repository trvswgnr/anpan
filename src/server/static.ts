import { join, resolve } from "node:path";

/**
 * Attempt to serve a static file from `publicDir`.
 * Returns `null` if the file doesn't exist (caller should continue routing).
 */
export async function serveStatic(
  publicDir: string,
  pathname: string,
): Promise<Response | null> {
  const root = resolve(publicDir);
  // resolve() normalises `.` and `..` — if the result escapes root, reject it.
  const filePath = resolve(join(root, pathname));
  if (!filePath.startsWith(root + "/") && filePath !== root) return null;

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
