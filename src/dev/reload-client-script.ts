/**
 * Minified dev reload client: EventSource to `/__dev/reload`, reload on message,
 * retry on error. Injected into HTML in dev; keep in sync with SSE in reload-sse.ts.
 */
export const DEV_RELOAD_CLIENT_SCRIPT =
  "(function(){var es=new EventSource('/__dev/reload');" +
  "es.onmessage=function(e){if(e.data==='reload')location.reload()};" +
  "es.onerror=function(){setTimeout(function(){location.reload()},1000)}})();";
