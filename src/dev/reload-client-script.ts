/**
 * Minified dev reload client: EventSource to `/__dev/reload`, reload on message.
 * Injected into HTML in dev; keep in sync with SSE in reload-sse.ts.
 *
 * The browser reconnects automatically after transient SSE errors; we do not
 * full-page reload on `error` (that caused spurious reloads). Hot reload still
 * runs when the server sends `data: reload` after file changes.
 *
 * `beforeunload` and `pagehide` both call `es.close()` so the server stream
 * cancels during MPA navigation. Without that, Bun may not see the disconnect
 * and connections leak, exhausting the HTTP/1.1 per-origin connection pool
 * after ~6 navigations. `pagehide` covers cases where `beforeunload` is unreliable
 * (e.g. some mobile / bfcache scenarios).
 */
export const DEV_RELOAD_CLIENT_SCRIPT =
  "(function(){var es=new EventSource('/__dev/reload');" +
  "es.onmessage=function(e){if(e.data==='reload')location.reload()};" +
  "function c(){try{es.close()}catch(e){}};" +
  "window.addEventListener('beforeunload',c);" +
  "window.addEventListener('pagehide',c)})();";
