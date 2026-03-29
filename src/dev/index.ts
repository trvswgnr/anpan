import { createServer, type ServerConfig } from "../server/index.ts";
import type { Middleware } from "../middleware/index.ts";

// ---------------------------------------------------------------------------
// Dev server — wraps createServer() and adds:
//   • File watching via Bun's native FS watcher
//   • SSE hot-reload endpoint (/__dev/reload)
//   • Injects a tiny hot-reload script into every page (done in renderer)
// ---------------------------------------------------------------------------

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
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  // SSE middleware — intercepts /__dev/reload before any other routing
  const sseMiddleware: Middleware = async (req, next) => {
    if (new URL(req.url).pathname !== "/__dev/reload") return next(req);

    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        clients.add(controller);
        // Initial comment keeps some proxies from buffering
        controller.enqueue(encoder.encode(": connected\n\n"));
      },
      cancel() {
        clients.delete(ctrl);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  };

  const server = await createServer({
    ...config,
    dev: true,
    middleware: [sseMiddleware, ...(config.middleware ?? [])],
  });

  const pagesDir = config.pagesDir ?? "./src/pages";

  // Watch the pages directory for changes
  setupWatcher(pagesDir, async () => {
    // Reload routes + island bundles
    const reload = (server as unknown as { __reloadRoutes?: () => Promise<void> }).__reloadRoutes;
    if (reload) await reload();

    // Signal all SSE clients
    const msg = encoder.encode("data: reload\n\n");
    for (const ctrl of clients) {
      try {
        ctrl.enqueue(msg);
      } catch {
        clients.delete(ctrl);
      }
    }
  });

  console.log(`[dev] Watching ${pagesDir} for changes`);
  console.log(`[dev] Server running at ${server.url}`);

  return server;
}

// ---------------------------------------------------------------------------
// File watcher using Bun's built-in FS watch
// ---------------------------------------------------------------------------

function setupWatcher(dir: string, onChange: () => void): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bunWatch = (Bun as any).watch as ((dir: string) => AsyncIterable<{ eventType: string }>) | undefined;
  try {
    const watcher = bunWatch ? bunWatch(dir) : null;
    if (!watcher) {
      console.warn("[dev] Bun.watch not available — hot reload disabled");
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
    console.warn("[dev] File watching unavailable — hot reload disabled");
  }
}

// ---------------------------------------------------------------------------
// Hot reload script injected by the renderer in dev mode
// ---------------------------------------------------------------------------

export const DEV_RELOAD_SCRIPT = `
(function() {
  var es = new EventSource('/__dev/reload');
  es.onmessage = function(e) { if (e.data === 'reload') location.reload(); };
  es.onerror = function() { setTimeout(function() { location.reload(); }, 1000); };
})();
`.trim();
