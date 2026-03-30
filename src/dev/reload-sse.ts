import type { Middleware } from "../middleware/index.ts";

/**
 * SSE endpoint for `/__dev/reload` — used by the dev script injected into pages
 * when `isDev` is true. `createServer` registers this whenever dev mode is on;
 * `createDevServer` additionally watches files and calls `broadcastReload`.
 */
export function createDevReloadSseMiddleware(): {
  middleware: Middleware;
  broadcastReload: () => void;
} {
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  const middleware: Middleware = async (req, next) => {
    if (new URL(req.url).pathname !== "/__dev/reload") return next(req);

    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        clients.add(controller);
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

  const broadcastReload = () => {
    const msg = encoder.encode("data: reload\n\n");
    for (const ctrl of clients) {
      try {
        ctrl.enqueue(msg);
      } catch {
        clients.delete(ctrl);
      }
    }
  };

  return { middleware, broadcastReload };
}
