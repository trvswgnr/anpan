import { resolve } from "node:path";
import { watch } from "node:fs/promises";
import { createServer, type ServerConfig, type ServerLogger } from "../server/index.ts";
import { DEV_RELOAD_CLIENT_SCRIPT } from "./reload-client-script.ts";

/**
 * Create the dev server.
 *
 * Same as `createServer()` but watches `pagesDir` for changes and sends a
 * reload signal to the browser over SSE. A small script is injected into
 * every page that listens for the signal and calls `location.reload()`.
 */
export async function createDevServer(
  config: ServerConfig = {},
): Promise<ReturnType<typeof Bun.serve>> {
  const log: ServerLogger = config.logger ?? console;

  const server = await createServer({
    ...config,
    dev: true,
    middleware: config.middleware ?? [],
    logger: log,
  });

  const pagesDir = config.pagesDir ?? "./src/pages";
  const broadcast = (server as unknown as { __broadcastDevReload?: () => void }).__broadcastDevReload;

  setupWatcher(pagesDir, async () => {
    const reload = (server as unknown as { __reloadRoutes?: () => Promise<void> }).__reloadRoutes;
    if (reload) await reload();
    broadcast?.();
  }, log);

  log.log(`[dev] Watching ${pagesDir} for changes`);
  log.log(`[dev] Server running at ${server.url}`);

  return server;
}

/** `node:fs/promises.watch` + debounce; falls back with a warning if watch fails. */
function setupWatcher(dir: string, onChange: () => void, log: ServerLogger): void {
  const absDir = resolve(dir);
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = undefined;
      onChange();
    }, 100);
  };

  (async () => {
    try {
      const watcher = watch(absDir, { recursive: true });
      for await (const _event of watcher) {
        schedule();
      }
    } catch (err) {
      log.warn("[dev] File watching unavailable - hot reload disabled");
      log.error("[dev]", err);
    }
  })().catch((err) => log.error("[dev] File watcher crashed:", err));
}

export const DEV_RELOAD_SCRIPT = DEV_RELOAD_CLIENT_SCRIPT;
