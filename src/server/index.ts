import { join } from "node:path";
import { scanRoutes, matchRoute } from "../router/index.ts";
import type { Route } from "../router/types.ts";
import { createIslandPlugin } from "../islands/plugin.ts";
import {
  renderPage,
  renderErrorPage,
  renderNotFound,
  type PageModule,
} from "../renderer/index.ts";
import { serveStatic } from "./static.ts";
import { runMiddleware, type Middleware } from "../middleware/index.ts";
import {
  bundleIslands,
  serveIsland,
  ISLANDS_OUT_DIR,
  ISLANDS_SERVE_PATH,
} from "../islands/bundler.ts";
import type { IslandBundleResult } from "../islands/bundler.ts";
import type { IslandManifest } from "../islands/types.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ServerConfig {
  /** Directory containing page files. Default: "./src/pages" */
  pagesDir?: string;
  /** Root source directory scanned for .island.tsx files. Defaults to the
   *  parent of pagesDir so components/ siblings are included. */
  srcDir?: string;
  /** Directory for static assets. Default: "./public" */
  publicDir?: string;
  /** Port to listen on. Default: 3000 */
  port?: number;
  /** Hostname. Default: "0.0.0.0" */
  hostname?: string;
  /** Middleware chain executed before route handlers */
  middleware?: Middleware[];
  /** Enable development mode (verbose errors, hot reload). */
  dev?: boolean;
}

// ---------------------------------------------------------------------------
// createServer
// ---------------------------------------------------------------------------

/**
 * Create and start the HTTP server.
 *
 * Scans pagesDir for routes, bundles islands from srcDir, and calls
 * Bun.serve(). Returns the server instance.
 *
 * @example
 * ```ts
 * const server = await createServer({
 *   pagesDir: "./src/pages",
 *   port: 3000,
 * });
 * ```
 */
export async function createServer(config: ServerConfig = {}): Promise<ReturnType<typeof Bun.serve>> {
  // Register the auto-island plugin so .island.tsx files can omit the
  // island(Component, import.meta.path) boilerplate. Must happen before any
  // island files are dynamically imported.
  Bun.plugin(createIslandPlugin());

  const pagesDir = resolve(config.pagesDir ?? "./src/pages");
  const publicDir = resolve(config.publicDir ?? "./public");
  const islandOutDir = resolve(ISLANDS_OUT_DIR);
  const isDev = config.dev ?? process.env.NODE_ENV !== "production";
  const middleware = config.middleware ?? [];

  // Island scan root: explicit srcDir, or parent of pagesDir so that
  // sibling directories like components/ are included automatically.
  const srcDir = config.srcDir
    ? resolve(config.srcDir)
    : join(pagesDir, "..");

  // Scan routes
  let routes: Route[] = await scanRoutes(pagesDir);

  // Bundle islands — scan from srcDir, not just pagesDir
  let { manifest: islandManifest, runtimeUrl: islandRuntimeUrl }: IslandBundleResult =
    await bundleIslands(srcDir, islandOutDir);

  // ---------------------------------------------------------------------------
  // Core fetch handler
  // ---------------------------------------------------------------------------
  const handleRequest = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;

    // 1. Island static files
    const islandResponse = await serveIsland(islandOutDir, pathname);
    if (islandResponse) return islandResponse;

    // 2. Static public files
    const staticResponse = await serveStatic(publicDir, pathname);
    if (staticResponse) return staticResponse;

    // 3. Match route
    const match = matchRoute(routes, pathname);

    if (!match) {
      return renderNotFound({
        match: { route: routes[0]!, params: {} },
        req,
        allRoutes: routes,
        islandManifest,
        islandRuntimeUrl,
        islandOutDir,
        isDev,
      });
    }

    const renderCtx = { match, req, allRoutes: routes, islandManifest, islandRuntimeUrl, islandOutDir, isDev };

    // 4. API route
    if (match.route.type === "api") {
      return handleApiRoute(req, match.route.filePath, match.params);
    }

    // 5. Page route
    return renderPage(renderCtx);
  };

  // Wrap with middleware
  const fetch = async (req: Request): Promise<Response> => {
    let res: Response;
    try {
      res = await runMiddleware(middleware, req, handleRequest);
    } catch (err) {
      console.error("[server] Unhandled error:", err);
      res = await renderErrorPage(
        {
          match: { route: routes[0]!, params: {} },
          req,
          allRoutes: routes,
          islandManifest,
          islandRuntimeUrl,
          islandOutDir,
          isDev,
        },
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    return applySecurityHeaders(await maybeCompress(req, res));
  };

  const server = Bun.serve({
    port: config.port ?? 3000,
    hostname: config.hostname ?? "0.0.0.0",
    fetch,
    error(err) {
      console.error("[server] Fatal:", err);
      return new Response("Internal Server Error", { status: 500 });
    },
    development: isDev,
  });

  // Graceful shutdown on SIGTERM / SIGINT
  const shutdown = () => {
    server.stop(true);
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  // Expose reload helper for dev server
  (server as unknown as Record<string, unknown>).__reloadRoutes = async () => {
    routes = await scanRoutes(pagesDir);
    ({ manifest: islandManifest, runtimeUrl: islandRuntimeUrl } =
      await bundleIslands(srcDir, islandOutDir));
  };

  return server;
}

// ---------------------------------------------------------------------------
// API route handler
// ---------------------------------------------------------------------------

export type ApiHandler = (
  req: Request,
  ctx: { params: Record<string, string> },
) => Response | Promise<Response>;

async function handleApiRoute(
  req: Request,
  filePath: string,
  params: Record<string, string>,
): Promise<Response> {
  const mod = await import(filePath) as Record<string, ApiHandler | undefined>;
  const method = req.method.toUpperCase();
  const handler = mod[method] ?? mod["default"];

  if (!handler) {
    return new Response(`Method ${method} not allowed`, {
      status: 405,
      headers: { Allow: Object.keys(mod).join(", ") },
    });
  }

  return handler(req, { params });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function resolve(path: string): string {
  if (path.startsWith("/")) return path;
  return join(process.cwd(), path);
}

const COMPRESSIBLE_RE = /text\/|application\/(json|javascript|xml|x-www-form-urlencoded)/;

/**
 * Compress the response body with gzip or deflate based on the client's
 * Accept-Encoding header. Brotli is not yet supported by CompressionStream
 * in Bun. Skips already-encoded responses and non-compressible content types.
 */
async function maybeCompress(req: Request, res: Response): Promise<Response> {
  if (!res.body || res.headers.has("Content-Encoding")) return res;

  const ct = res.headers.get("Content-Type") ?? "";
  if (!COMPRESSIBLE_RE.test(ct)) return res;

  const accept = req.headers.get("Accept-Encoding") ?? "";
  const encoding: CompressionFormat | null =
    accept.includes("gzip") ? "gzip" :
    accept.includes("deflate") ? "deflate" :
    null;

  if (!encoding) return res;

  const compressed = res.body.pipeThrough(new CompressionStream(encoding));
  const headers = new Headers(res.headers);
  headers.set("Content-Encoding", encoding);
  headers.delete("Content-Length");
  return new Response(compressed, { status: res.status, statusText: res.statusText, headers });
}

/**
 * Adds default security headers to every response.
 * These are safe, non-breaking defaults — apps can override via middleware.
 */
function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  if (!headers.has("X-Content-Type-Options")) {
    headers.set("X-Content-Type-Options", "nosniff");
  }
  if (!headers.has("X-Frame-Options")) {
    headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  if (!headers.has("Referrer-Policy")) {
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }
  if (!headers.has("X-XSS-Protection")) {
    headers.set("X-XSS-Protection", "0");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
