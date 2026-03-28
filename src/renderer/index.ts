import { renderToString } from "../jsx/runtime.ts";
import type { VNode, Child } from "../jsx/types.ts";
import { HeadContext, runWithHeadContext } from "./head.ts";
import { IslandRegistry, runWithIslandRegistry } from "../islands/index.ts";
import type { IslandManifest } from "../islands/types.ts";
import { findLayouts } from "../router/index.ts";
import type { Route, RouteContext, RouteMatch } from "../router/types.ts";
import { ISLANDS_SERVE_PATH, RUNTIME_BUNDLE } from "../islands/bundler.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageModule {
  default: (props: PageProps) => VNode | Child | null;
  config?: { streaming?: boolean };
}

export interface LayoutModule {
  default: (props: LayoutProps) => VNode | Child | null;
}

export interface PageProps extends RouteContext {}

export interface LayoutProps extends RouteContext {
  children: VNode | null;
  head: string; // serialized <head> inner HTML
}

export interface RenderContext {
  match: RouteMatch;
  req: Request;
  allRoutes: Route[];
  islandManifest: IslandManifest;
  islandOutDir: string;
  isDev: boolean;
}

// ---------------------------------------------------------------------------
// renderPage — streams a full HTML document
// ---------------------------------------------------------------------------

export async function renderPage(ctx: RenderContext): Promise<Response> {
  const { match, req, allRoutes, islandManifest, isDev } = ctx;
  const url = new URL(req.url);
  const routeCtx: RouteContext = { params: match.params, url, req };

  // Set up per-request contexts
  const headCtx = new HeadContext();
  const islandReg = new IslandRegistry(islandManifest);

  // Dynamic import of page module
  let pageMod: PageModule;
  try {
    pageMod = await import(match.route.filePath) as PageModule;
  } catch (err) {
    throw new Error(`Failed to load page module: ${match.route.filePath}\n${err}`);
  }

  if (typeof pageMod.default !== "function") {
    throw new Error(`Page module must export a default function: ${match.route.filePath}`);
  }

  // Find applicable layouts (closest first)
  const layouts = findLayouts(allRoutes, match.route);

  // Pre-load all layout modules
  const layoutMods: LayoutModule[] = [];
  for (const layoutRoute of layouts) {
    const mod = await import(layoutRoute.filePath) as LayoutModule;
    if (typeof mod.default === "function") layoutMods.push(mod);
  }

  // Render the full VNode tree AND collect <Head> content in one pass.
  // All component calls (page, layouts, Head) happen inside renderToString,
  // so we keep HeadContext active throughout the entire render.
  let rawHtml = "";
  runWithHeadContext(headCtx, () => {
    runWithIslandRegistry(islandReg, () => {
      // Build the VNode tree (components are invoked by renderToString, not here)
      let content: VNode | Child | null = pageMod.default(routeCtx);

      // Wrap in layouts outermost-last
      for (const layoutMod of layoutMods) {
        const inner = content;
        content = layoutMod.default({
          ...routeCtx,
          children: inner as VNode | null,
          head: "", // head placeholder — filled after rendering via HTMLRewriter
        });
      }

      rawHtml = renderToString(content);
    });
  });

  // Inject island bootstrap scripts
  const islandScripts = buildIslandScripts(islandReg, isDev);
  const finalHtml = await injectHead(rawHtml, headCtx.serialize(), islandScripts, isDev);

  // Stream the HTML in chunks for true streaming delivery
  return new Response(stringToStream(finalHtml), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ---------------------------------------------------------------------------
// Inject head content and island scripts using HTMLRewriter (string-based).
// Note: Bun's HTMLRewriter only supports string/Uint8Array bodies, not streams.
// ---------------------------------------------------------------------------

async function injectHead(
  html: string,
  headHtml: string,
  islandScripts: string,
  isDev: boolean,
): Promise<string> {
  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        if (headHtml) {
          el.append(`\n    ${headHtml}`, { html: true });
        }
        if (islandScripts) {
          el.append(`\n    ${islandScripts}`, { html: true });
        }
        if (isDev) {
          el.append(
            `\n    <script>(function(){var es=new EventSource('/__dev/reload');` +
            `es.onmessage=function(e){if(e.data==='reload')location.reload()};` +
            `es.onerror=function(){setTimeout(function(){location.reload()},1000)}})();</script>`,
            { html: true },
          );
        }
      },
    });

  return rewriter.transform(new Response(`<!DOCTYPE html>\n${html}`)).text();
}

// ---------------------------------------------------------------------------
// Stream a string as Uint8Array chunks for true streaming delivery
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 16 * 1024; // 16 KB per chunk

function stringToStream(html: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;
      while (offset < html.length) {
        controller.enqueue(encoder.encode(html.slice(offset, offset + CHUNK_SIZE)));
        offset += CHUNK_SIZE;
      }
      controller.close();
    },
  });
}

function buildIslandScripts(reg: IslandRegistry, isDev: boolean): string {
  if (reg.encountered.size === 0) return "";

  const runtimeUrl = `${ISLANDS_SERVE_PATH}/${RUNTIME_BUNDLE}`;
  const lines = [`<script type="module" src="${runtimeUrl}"></script>`];

  for (const [id, meta] of reg.encountered) {
    lines.push(
      `<script type="module">` +
      `import{hydrate}from"${runtimeUrl}";` +
      `import Component from"${meta.bundleUrl}";` +
      `hydrate("${id}",Component);` +
      `</script>`,
    );
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Render an error page
// ---------------------------------------------------------------------------

export async function renderErrorPage(
  ctx: RenderContext,
  error: Error,
): Promise<Response> {
  const { allRoutes, req, islandManifest, islandOutDir, isDev } = ctx;
  const errorRoute = allRoutes.find((r) => r.type === "error");

  if (errorRoute) {
    try {
      return await renderPage({
        ...ctx,
        match: { route: errorRoute, params: {} },
      });
    } catch {
      // Fall through to inline error
    }
  }

  const html = isDev
    ? `<!DOCTYPE html><html><head><title>Error</title></head><body>` +
      `<h1>500 Internal Server Error</h1><pre>${escapeHtml(error.stack ?? error.message)}</pre>` +
      `</body></html>`
    : `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>500 Internal Server Error</h1></body></html>`;

  return new Response(html, {
    status: 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Render a 404 page
// ---------------------------------------------------------------------------

export async function renderNotFound(ctx: RenderContext): Promise<Response> {
  const { allRoutes } = ctx;
  const notFoundRoute = allRoutes.find((r) => r.type === "notfound");

  if (notFoundRoute) {
    try {
      const res = await renderPage({
        ...ctx,
        match: { route: notFoundRoute, params: {} },
      });
      return new Response(res.body, {
        status: 404,
        headers: res.headers,
      });
    } catch {
      // Fall through
    }
  }

  return new Response(
    `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
