import type { Middleware } from "../middleware/index.ts";

/**
 * SSE endpoint for `/__dev/reload` — used by the dev script injected into pages
 * when `isDev` is true. `createServer` registers this whenever dev mode is on;
 * `createDevServer` additionally watches files and calls `broadcastReload`.
 */
/** Bun.serve default idle timeout is 10s; ping before that so the stream stays alive. */
const SSE_KEEPALIVE_MS = 8_000;

export function createDevReloadSseMiddleware(): {
  middleware: Middleware;
  broadcastReload: () => void;
} {
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  const middleware: Middleware = async (req, next) => {
    if (new URL(req.url).pathname !== "/__dev/reload") return next(req);

    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    let keepalive: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        clients.add(controller);
        controller.enqueue(encoder.encode(": connected\n\n"));
        keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            if (keepalive) clearInterval(keepalive);
            clients.delete(controller);
          }
        }, SSE_KEEPALIVE_MS);
      },
      cancel() {
        if (keepalive) clearInterval(keepalive);
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
