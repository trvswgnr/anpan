import { join } from "node:path";
import { scanRoutes, matchRoute } from "../router/index.ts";
import type { Route } from "../router/types.ts";
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

export async function createServer(config: ServerConfig = {}): Promise<ReturnType<typeof Bun.serve>> {
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
  let islandManifest: IslandManifest = await bundleIslands(srcDir, islandOutDir);

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
        islandOutDir,
        isDev,
      });
    }

    const renderCtx = { match, req, allRoutes: routes, islandManifest, islandOutDir, isDev };

    // 4. API route
    if (match.route.type === "api") {
      return handleApiRoute(req, match.route.filePath, match.params);
    }

    // 5. Page route
    return renderPage(renderCtx);
  };

  // Wrap with middleware
  const fetch = async (req: Request): Promise<Response> => {
    try {
      return await runMiddleware(middleware, req, handleRequest);
    } catch (err) {
      console.error("[server] Unhandled error:", err);
      return renderErrorPage(
        {
          match: { route: routes[0]!, params: {} },
          req,
          allRoutes: routes,
          islandManifest,
          islandOutDir,
          isDev,
        },
        err instanceof Error ? err : new Error(String(err)),
      );
    }
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

  // Expose reload helper for dev server
  (server as unknown as Record<string, unknown>).__reloadRoutes = async () => {
    routes = await scanRoutes(pagesDir);
    islandManifest = await bundleIslands(srcDir, islandOutDir);
  };

  return server;
}

// ---------------------------------------------------------------------------
// API route handler
// ---------------------------------------------------------------------------

type ApiHandler = (
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
