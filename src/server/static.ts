import { join } from "node:path";

/**
 * Attempt to serve a static file from `publicDir`.
 * Returns `null` if the file doesn't exist (caller should continue routing).
 */
export async function serveStatic(
  publicDir: string,
  pathname: string,
): Promise<Response | null> {
  // Prevent directory traversal
  const safePath = pathname.replace(/\.\./g, "").replace(/\/+/g, "/");
  const filePath = join(publicDir, safePath);

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  // Don't serve directories
  const stat = await file.stat?.() ?? null;
  if (stat && (stat as unknown as { isDirectory?: () => boolean }).isDirectory?.()) return null;

  return new Response(file, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
