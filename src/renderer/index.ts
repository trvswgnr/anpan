import { renderToString } from "../jsx/runtime.ts";
import type { VNode, Child } from "../jsx/types.ts";
import { HeadContext, runWithHeadContext } from "./head.ts";
import { IslandRegistry, runWithIslandRegistry } from "../islands/index.ts";
import type { IslandManifest } from "../islands/types.ts";
import { findLayouts } from "../router/index.ts";
import type { Route, RouteContext, RouteMatch, Loader, LoaderReturn } from "../router/types.ts";
import { ISLANDS_SERVE_PATH } from "../islands/bundler.ts";

// Types

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PageModule {
  default: (props: any) => VNode | Child | null;
  loader?: Loader;
  config?: { streaming?: boolean };
}

export interface LayoutModule {
  default: (props: LayoutProps) => VNode | Child | null;
}

/**
 * Props passed to every page component.
 *
 * TLoader - the page's `loader` export (pass `typeof loader` for typed data).
 * TParams - shape of route params (e.g. `{ slug: string }` for `[slug].tsx`).
 *
 * @example
 * // pages/blog/[slug].tsx
 * type Params = { slug: string };
 *
 * export const loader = async ({ params }: RouteContext<Params>) => {
 *   const post = getPost(params.slug);
 *   if (!post) return notFound();
 *   return { data: { post } };
 * };
 *
 * export default function Post({ data, params }: PageProps<typeof loader, Params>) {
 *   return <h1>{data.post.title}</h1>; // data is typed!
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PageProps<
  TLoader extends ((...args: any[]) => any) | undefined = undefined,
  TParams extends Record<string, string> = Record<string, string>,
> = RouteContext<TParams> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: TLoader extends (...args: any[]) => Promise<{ data: infer D } | Response> | { data: infer D } | Response
    ? D
    : undefined;
};

export interface LayoutProps extends RouteContext {
  children: VNode | null;
}

export interface RenderContext {
  match: RouteMatch;
  req: Request;
  allRoutes: Route[];
  islandManifest: IslandManifest;
  /** Serve URL for the hydration runtime, e.g. /_islands/__runtime.js */
  islandRuntimeUrl: string;
  islandOutDir: string;
  isDev: boolean;
}

// Content marker - emitted by renderToString where {children} appears in
// the layout, so we can split the layout shell into before/after.

/** Unique sentinel emitted into the layout HTML where the page content goes. */
const CONTENT_MARKER = "<!--_BWFW_CONTENT_-->";

/** Special VNode type that emits CONTENT_MARKER during renderToString. */
export const CONTENT_MARKER_TYPE = "__bwfw_content_marker__";

// renderPage - true streaming: head sent immediately, body follows

export async function renderPage(ctx: RenderContext): Promise<Response> {
  const { match, req, allRoutes, islandManifest, islandRuntimeUrl, isDev } = ctx;
  const url = new URL(req.url);
  const routeCtx: RouteContext = { params: match.params, url, req };

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

  // ---------------------------------------------------------------------------
  // Run the optional loader. If it returns a Response, short-circuit rendering.
  // Otherwise pass the data to the page component.
  // ---------------------------------------------------------------------------
  let loaderData: unknown = undefined;
  let responseStatus = 200;
  let responseHeaders: Record<string, string> = {};

  if (typeof pageMod.loader === "function") {
    let loaderResult: LoaderReturn;
    try {
      loaderResult = await pageMod.loader(routeCtx);
    } catch (err) {
      throw new Error(`Loader threw in ${match.route.filePath}\n${err}`);
    }

    if (loaderResult instanceof Response) {
      const status = loaderResult.status;
      // Redirects - return immediately.
      if (status >= 300 && status < 400) return loaderResult;
      // 404 - render the custom _404 page (wrapped in layout) with 404 status.
      if (status === 404) return renderNotFound(ctx);
      // Other error responses - return as-is.
      return loaderResult;
    }

    loaderData = loaderResult.data;
    if (loaderResult.status !== undefined) responseStatus = loaderResult.status;
    if (loaderResult.headers) responseHeaders = loaderResult.headers;
  }

  // Pre-load layout modules
  const layouts = findLayouts(allRoutes, match.route);
  const layoutMods: LayoutModule[] = [];
  for (const layoutRoute of layouts) {
    const mod = await import(layoutRoute.filePath) as LayoutModule;
    if (typeof mod.default === "function") layoutMods.push(mod);
  }

  // ---------------------------------------------------------------------------
  // Phase 1 - render the page component.
  //   * Calls <Head> which registers head content into headCtx.
  //   * Calls island() wrappers which register into islandReg.
  //   * Result: pageHtml string + all metadata known.
  // ---------------------------------------------------------------------------
  const pageCtx = { ...routeCtx, data: loaderData };

  let pageHtml = "";
  runWithHeadContext(headCtx, () => {
    runWithIslandRegistry(islandReg, () => {
      pageHtml = renderToString(pageMod.default(pageCtx));
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 2 - render the layout shell with a content marker where {children}
  // goes. This gives us the full outer HTML structure immediately, without
  // needing the page HTML to be ready first.
  //   * layouts[0] = innermost, layouts[last] = outermost root layout.
  //   * We wrap innermost -> outermost so root layout is the outermost element.
  //
  // Must run inside runWithIslandRegistry so islands used in layouts (e.g. a
  // ThemeToggle in the nav) register and get hydration scripts injected.
  // ---------------------------------------------------------------------------
  const markerVNode: VNode = { type: CONTENT_MARKER_TYPE, props: {} };
  let shellContent: VNode | Child | null = markerVNode;

  for (const layoutMod of layoutMods) {
    const inner = shellContent;
    shellContent = layoutMod.default({
      ...routeCtx,
      children: inner as VNode | null,
    });
  }

  let layoutHtml = "";
  runWithIslandRegistry(islandReg, () => {
    layoutHtml = renderToString(shellContent);
  });

  const headInjection = buildHeadInjection(
    headCtx.serialize(),
    buildIslandScripts(islandReg, islandRuntimeUrl),
    isDev,
  );

  // Split the layout shell at the content marker
  const markerPos = layoutHtml.indexOf(CONTENT_MARKER);
  const shellBefore = markerPos >= 0 ? layoutHtml.slice(0, markerPos) : layoutHtml;
  const shellAfter = markerPos >= 0 ? layoutHtml.slice(markerPos + CONTENT_MARKER.length) : "";

  // Inject <head> additions (title, meta, island scripts, dev reload) just
  // before </head> in the layout's head section.
  const shellBeforeWithHead = spliceBeforeCloseHead(shellBefore, headInjection);

  // ---------------------------------------------------------------------------
  // Stream - 3 chunks:
  //   1. DOCTYPE + layout shell head/opening body (sent immediately)
  //   2. Page HTML (available right away since Phase 1 is synchronous)
  //   3. Layout shell closing tags (footer, </body>, </html>)
  //
  // When Phase 1 becomes async (data fetching, Suspense), chunk 1 will land
  // in the browser before chunk 2 is ready - that's the streaming payoff.
  // ---------------------------------------------------------------------------
  return new Response(
    buildStream(`<!DOCTYPE html>\n${shellBeforeWithHead}`, pageHtml, shellAfter),
    {
      status: responseStatus,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
        ...responseHeaders,
      },
    },
  );
}

// Streaming helpers

const encoder = new TextEncoder();

/**
 * Build a ReadableStream from three pre-computed string segments.
 * Each segment is its own chunk - the browser can start parsing chunk 1
 * while chunks 2 and 3 are still being assembled.
 *
 * When async page rendering is added (data fetching, Suspense), chunk 2
 * will be a ReadableStream that we pipe rather than a string.
 */
function buildStream(
  before: string,
  content: string,
  after: string,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      // Send the full <head> + layout opening immediately so the browser
      // can start fetching CSS/fonts before the body is ready.
      if (before) controller.enqueue(encoder.encode(before));
      // Send page body content.
      if (content) controller.enqueue(encoder.encode(content));
      // Send layout closing tags.
      if (after) controller.enqueue(encoder.encode(after));
      controller.close();
    },
  });
}

/** Insert extra content just before </head>. Falls back to prepending. */
function spliceBeforeCloseHead(html: string, extra: string): string {
  if (!extra) return html;
  const idx = html.lastIndexOf("</head>");
  if (idx < 0) return extra + html;
  return html.slice(0, idx) + "\n  " + extra + "\n" + html.slice(idx);
}

function buildHeadInjection(headHtml: string, islandScripts: string, isDev: boolean): string {
  const parts: string[] = [];
  if (headHtml) parts.push(headHtml);
  if (islandScripts) parts.push(islandScripts);
  if (isDev) {
    parts.push(
      `<script>(function(){var es=new EventSource('/__dev/reload');` +
      `es.onmessage=function(e){if(e.data==='reload')location.reload()};` +
      `es.onerror=function(){setTimeout(function(){location.reload()},1000)}})();</script>`,
    );
  }
  return parts.join("\n  ");
}

function buildIslandScripts(reg: IslandRegistry, runtimeUrl: string): string {
  if (reg.encountered.size === 0) return "";
  // The runtime script auto-hydrates all island-placeholder elements on load
  // by reading data-bundle from each placeholder. No per-island scripts needed.
  return `<script type="module" src="${runtimeUrl}"></script>`;
}

// Error / 404 pages

export async function renderErrorPage(
  ctx: RenderContext,
  error: Error,
): Promise<Response> {
  const { allRoutes, isDev } = ctx;
  const errorRoute = allRoutes.find((r) => r.type === "error");

  if (errorRoute) {
    try {
      return await renderPage({ ...ctx, match: { route: errorRoute, params: {} } });
    } catch {
      // fall through
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

export async function renderNotFound(ctx: RenderContext): Promise<Response> {
  const { allRoutes } = ctx;
  const notFoundRoute = allRoutes.find((r) => r.type === "notfound");

  if (notFoundRoute) {
    try {
      const res = await renderPage({ ...ctx, match: { route: notFoundRoute, params: {} } });
      return new Response(res.body, { status: 404, headers: res.headers });
    } catch {
      // fall through
    }
  }

  return new Response(
    `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
