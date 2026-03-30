import { createServer, type ServerConfig } from "../server/index.ts";
import { DEV_RELOAD_CLIENT_SCRIPT } from "./reload-client-script.ts";

// Dev server - wraps createServer() and adds:
//   * File watching via Bun's native FS watcher (browser reload on source change)
//   * createServer already registers /__dev/reload SSE and injects the reload script in dev

/**
 * Create the dev server.
 *
 * Same as createServer() but watches pagesDir for file changes and sends a
 * reload signal to the browser over SSE. A small script is injected into
 * every page that listens for the signal and calls location.reload().
 */
export async function createDevServer(
  config: ServerConfig = {},
): Promise<ReturnType<typeof Bun.serve>> {
  const server = await createServer({
    ...config,
    dev: true,
    middleware: config.middleware ?? [],
  });

  const pagesDir = config.pagesDir ?? "./src/pages";
  const broadcast = (server as unknown as { __broadcastDevReload?: () => void }).__broadcastDevReload;

  // Watch the pages directory for changes
  setupWatcher(pagesDir, async () => {
    const reload = (server as unknown as { __reloadRoutes?: () => Promise<void> }).__reloadRoutes;
    if (reload) await reload();
    broadcast?.();
  });

  console.log(`[dev] Watching ${pagesDir} for changes`);
  console.log(`[dev] Server running at ${server.url}`);

  return server;
}

// File watcher using Bun's built-in FS watch

function setupWatcher(dir: string, onChange: () => void): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bunWatch = (Bun as any).watch as ((dir: string) => AsyncIterable<{ eventType: string }>) | undefined;
  try {
    const watcher = bunWatch ? bunWatch(dir) : null;
    if (!watcher) {
      console.warn("[dev] Bun.watch not available - hot reload disabled");
      return;
    }

    (async () => {
      for await (const event of watcher) {
        if (event.eventType === "rename" || event.eventType === "change") {
          onChange();
        }
      }
    })().catch(console.error);
  } catch {
    console.warn("[dev] File watching unavailable - hot reload disabled");
  }
}

// Hot reload script injected by the renderer in dev mode (same source as buildHeadInjection)

export const DEV_RELOAD_SCRIPT = DEV_RELOAD_CLIENT_SCRIPT;
