# anpan

A small SSR framework built on [Bun](https://bun.sh). Pages are TSX files, all rendering happens on the server, and interactive pieces are hydrated in the browser as islands. Ships its own minimal JSX runtime - no React required. React and Preact are also supported as first-class island adapters via auto-detection.

## Requirements

- Bun >= 1.1.0

## Install

```sh
bun add anpan
```

## Quick start

```
my-app/
  src/
    main.ts
    pages/
      index.tsx
      _layout.tsx
    components/
      Counter.island.tsx
  public/
    favicon.ico
  tsconfig.json
```

**tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM"],
    "strict": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "anpan"
  }
}
```

**src/main.ts**

```ts
import { createServer } from "anpan";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: 3000,
});

console.log(`http://localhost:${server.port}`);
```

**src/pages/index.tsx**

```tsx
import { Head } from "anpan";
import type { PageProps } from "anpan";

export default function HomePage({ url }: PageProps) {
  return (
    <>
      <Head>
        <title>Home</title>
      </Head>
      <h1>Hello world</h1>
    </>
  );
}
```

Run it:

```sh
bun run src/main.ts
```

## Examples

If you cloned this repository, the [`examples/`](examples/) directory contains runnable sample apps wired to the **local** framework source (no `bun link` required). From the repo root, run `bun install` once for tests and tooling, then `bun dev` to start the main dev example with hot reload. See [examples/README.md](examples/README.md) for every example, default ports, when to run `bun install` inside a folder, and how paths relate to the working directory.

## Pages

Every `.tsx` or `.ts` file inside `pagesDir` becomes a route.

| File | Route |
|------|-------|
| `pages/index.tsx` | `/` |
| `pages/about.tsx` | `/about` |
| `pages/blog/[slug].tsx` | `/blog/:slug` |
| `pages/docs/[...rest].tsx` | `/docs/*` |
| `pages/api/users.ts` | `/api/users` |

A page exports a default function that receives `PageProps` and returns JSX.

```tsx
import type { PageProps } from "anpan";

export default function BlogPost({ params }: PageProps) {
  return <article><h1>{params.slug}</h1></article>;
}
```

`PageProps` is generic. Pass your loader and param types for full type safety:

```ts
type PageProps<
  TLoader = undefined,   // typeof your loader export
  TParams = Record<string, string>
>
```

Example with typed params and loader data:

```tsx
type Params = { slug: string };

export const loader = async ({ params }: RouteContext<Params>) => {
  const post = getPost(params.slug);
  if (!post) return notFound();
  return { data: { post } };
};

export default function Post({ data, params }: PageProps<typeof loader, Params>) {
  // data.post is typed, params.slug is typed
  return <h1>{data.post.title}</h1>;
}
```

### Dynamic routes

Use `[param]` for a single segment and `[...param]` for a catch-all.

```
pages/blog/[slug].tsx        -> /blog/hello-world  -> params.slug = "hello-world"
pages/docs/[...path].tsx     -> /docs/a/b/c        -> params.path = "a/b/c"
```

Static routes always win over dynamic ones.

### Query strings

Query parameters are available via `url.searchParams` in the component, or via `new URL(req.url).searchParams` in a loader.

```tsx
// In a component
export default function BlogIndex({ url }: PageProps) {
  const tag = url.searchParams.get("tag"); // /blog?tag=bun
  return <p>Filtering by: {tag ?? "all"}</p>;
}

// In a loader
export const loader: Loader = async ({ req }) => {
  const tag = new URL(req.url).searchParams.get("tag");
  const posts = tag ? getPostsByTag(tag) : getAllPosts();
  return { data: { posts } };
};
```

## Layouts

A file named `_layout.tsx` wraps all pages in the same directory and below.

```tsx
import type { LayoutProps } from "anpan";

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Layouts nest. If you have `pages/_layout.tsx` and `pages/blog/_layout.tsx`, the blog layout wraps blog pages inside the root layout.

`LayoutProps` contains the same fields as `PageProps` (`params`, `url`, `req`) plus `children`.

Islands placed inside a layout (nav, sidebar, etc.) are bundled and hydrated the same way as islands inside pages.

## Head management

Use `<Head>` to set `<title>`, `<meta>`, and any other head elements from inside a page component. The content is collected during rendering and injected into the document `<head>` automatically.

```tsx
import { Head } from "anpan";

export default function Page() {
  return (
    <>
      <Head>
        <title>My page</title>
        <meta name="description" content="Page description" />
        <link rel="canonical" href="https://example.com/page" />
      </Head>
      <main>...</main>
    </>
  );
}
```

Rules:

- `<title>` deduplicates: the last one wins.
- `<meta name="...">` deduplicates by `name`.
- `<meta property="...">` deduplicates by `property`.
- Everything else appends.

## Loaders

A page can export a `loader` function. The loader runs on the server before the page component renders. Use it to fetch data, check auth, redirect, or return a 404.

```ts
import { notFound, redirect } from "anpan";
import type { Loader } from "anpan";

export const loader: Loader = async ({ params, req }) => {
  const session = getSession(req);
  if (!session) return redirect("/login");

  const post = await db.getPost(params.slug);
  if (!post) return notFound();

  return { data: { post, session } };
};

export default function Post({ data }: PageProps<typeof loader>) {
  return <h1>{data.post.title}</h1>;
}
```

The return value is either:

- `{ data: T }` - the `data` prop is passed to the page component, typed via `typeof loader`
- `Response` - returned directly; use `notFound()` or `redirect()` for common cases
- `{ data: T, status: number, headers: {...} }` - data with custom status or headers

### notFound()

Returns a 404 response. The framework renders your `_404.tsx` page (with layouts) at the 404 status.

```ts
if (!post) return notFound();
```

### redirect()

Returns a redirect response.

```ts
return redirect("/login");          // 302
return redirect("/new-url", 301);   // permanent
```

Allowed status codes: `301`, `302`, `307`, `308`.

### Caching

**HTTP caching** - `cacheFor(seconds)` returns `Cache-Control` headers that spread directly into a loader return value.

```ts
import { notFound, cacheFor } from "anpan";

export const loader: Loader = async ({ params }) => {
  const post = getPost(params.slug);
  if (!post) return notFound();
  // Cache for 5 minutes; serve stale for up to 1 minute while revalidating.
  return { data: { post }, ...cacheFor(300) };
};
```

**Server-side caching** - `cache(ttlMs, fn)` wraps any async function with an in-memory TTL cache. Results are keyed by the serialized arguments and expire after `ttlMs` milliseconds.

```ts
import { cache, notFound } from "anpan";
import type { Loader } from "anpan";

// Declare once at module level - cache is shared across all requests.
const getPost = cache(60_000, async (slug: string) => {
  return await db.posts.findOne({ slug });
});

export const loader: Loader<{ post: Post }, { slug: string }> = async ({ params }) => {
  const post = await getPost(params.slug); // DB hit once per minute per slug
  if (!post) return notFound();
  return { data: { post } };
};
```

Combine both for a full caching strategy:

```ts
export const loader: Loader = async ({ params }) => {
  const post = await getPost(params.slug);
  if (!post) return notFound();
  return { data: { post }, ...cacheFor(300) }; // server: 1 min, CDN: 5 min
};
```

For distributed caching (Redis, KV), pass a function that uses it - `cache()` is just a wrapper around any async function.

## API routes

Any file whose path contains `/api/` (e.g. `pages/api/users.ts`) is treated as an API route. Export named functions for each HTTP method.

```ts
// pages/api/users.ts
import type { ApiHandler } from "anpan";

export const GET: ApiHandler = (_req, { params }) => {
  return Response.json({ users: [] });
};

export const POST: ApiHandler = async (req, _ctx) => {
  const body = await req.json();
  return Response.json({ created: body }, { status: 201 });
};
```

Supported method exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Export `default` as a fallback that matches any method.

If a request arrives with a method that isn't exported (and no `default` export exists), the framework returns `405 Method Not Allowed` with an `Allow` header listing the methods the route does export.

## Islands

By default, every component is server-only: it renders to HTML and sends no JavaScript to the browser. An island is a component that also ships client-side JavaScript and gets hydrated in the browser.

### Defining an island

Name the file `*.island.tsx` and export a default function.

```tsx
// components/Counter.island.tsx
import { useState } from "anpan/islands";

export default function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <button onclick={() => setCount(count - 1)}>-</button>
      <span>{count}</span>
      <button onclick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

### Using an island

Import and use it like any other component. On the server it renders a static HTML snapshot. In the browser it becomes interactive.

```tsx
// pages/counter.tsx
import Counter from "../components/Counter.island.tsx";

export default function CounterPage() {
  return (
    <main>
      <Counter initial={5} />
    </main>
  );
}
```

### How it works

At startup, Bun bundles every `.island.tsx` file in `srcDir` for the browser. When a page containing an island is rendered:

1. The island renders to HTML (the static snapshot the user sees before JS loads).
2. It is wrapped in `<island-placeholder data-id="..." data-props="..." data-bundle="...">`.
3. A hydration script tag is injected into `<head>`.

In the browser, the client runtime finds each `<island-placeholder>`, imports the bundle, and mounts the live component.

### useState

`useState` inside an island works the same as React's hook in terms of API, but it is implemented with a tiny custom runtime - no React dependency.

```tsx
const [value, setValue] = useState(initialValue);
```

On the server, `useState` returns `[initialValue, noopSetter]` so the static snapshot always matches the initial state. In the browser it manages local state and triggers re-renders.

### Using React or Preact

If `jsxImportSource` in `tsconfig.json` is `"react"` or `"preact"`, the framework auto-detects it and uses the framework's own `renderToString` on the server and `createRoot` / `render` in the browser. No extra config needed.

**React**

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

Island components are plain React components. Install `react`, `react-dom`, and `@types/react` as dependencies. The framework handles server rendering and hydration automatically.

```tsx
// components/Counter.island.tsx - works with React hooks
import { useState } from "react";

export default function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <button onClick={() => setCount(count - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

**Preact**

Same as React - set `"jsxImportSource": "preact"` and install `preact`.

### Custom JSX framework

For any other framework (Solid.js, etc.), pass a `jsxFramework` adapter to `createServer()`:

```ts
import { renderToString } from "solid-js/web";

createServer({
  jsxFramework: {
    serverRender: (comp, props) => renderToString(() => (comp as any)(props)),
    clientMountSnippet:
      `import{render as __sr__}from"solid-js/web";` +
      `export const __islandMount=(el,props)=>__sr__(()=>__COMP__(props),el);`,
  },
});
```

The `clientMountSnippet` is appended to each island bundle. `__COMP__` is replaced with the actual component identifier. It must export a named function `__islandMount(el, props)` that mounts the component into `el`.

### Constraints

**Props must be JSON-serializable.** Island props are serialized to JSON and embedded in the HTML so the browser can reconstruct them. Functions, class instances, `undefined`, and circular references will be silently dropped.

```tsx
// [ok] fine - string, number, boolean, plain object, array
<Counter initial={5} label="count" data={{ x: 1 }} />

// [bad] dropped silently - functions cannot be serialized
<Counter onChange={() => doSomething()} />
```

**Only `useState` is available.** The client runtime provides `useState` and nothing else. There is no `useEffect`, `useRef`, `useContext`, or reducer. For "run on mount" behaviour, use a self-initialising pattern or access DOM APIs directly:

```tsx
export default function Map({ lat, lng }: { lat: number; lng: number }) {
  const [ready, setReady] = useState(false);

  // onclick or other event handlers are the entry point for side effects
  function init(el: HTMLDivElement) {
    // el is the live DOM element - call any browser API here
    loadMap(el, { lat, lng });
  }

  return <div ref={init} style="height:400px" />;
}
```

Note: `ref` callbacks are not supported by the runtime. For DOM access, use `document.querySelector` inside an event handler or a small `<script>` tag in the layout.

**Islands are isolated.** Each island manages its own state. There is no built-in mechanism for two islands on the same page to share state. Use a module-level variable, `localStorage`, a URL parameter, or a custom event (`dispatchEvent` / `addEventListener`) to communicate between islands.

```ts
// shared-state.ts - plain module, works fine
let globalCount = 0;
export const getCount = () => globalCount;
export const increment = () => { globalCount++; };
```

**Render is synchronous.** Island components cannot be `async` functions and cannot `await` during render. Fetch data in a loader (server-side) or in an event handler (client-side).

### Scan directory

The bundler scans `srcDir` for `.island.tsx` files. `srcDir` defaults to the parent of `pagesDir`, so `src/pages/` and `src/components/` are both covered automatically. You can override it:

```ts
createServer({ pagesDir: "./src/pages", srcDir: "./src" });
```

## Middleware

Middleware runs before every route handler. It follows the onion model: each function receives the request and a `next` function to call the next layer.

```ts
import type { Middleware } from "anpan";

const logger: Middleware = async (req, next) => {
  const start = Date.now();
  const res = await next(req);
  console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} ${Date.now() - start}ms`);
  return res;
};

const auth: Middleware = async (req, next) => {
  if (!req.headers.get("authorization")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return next(req);
};

const server = await createServer({
  middleware: [logger, auth],
});
```

Middleware runs in array order. Returning a response early short-circuits the rest of the chain.

## Static files

Files in `publicDir` (default: `./public`) are served directly at `/`. A file at `public/styles/main.css` is available at `/styles/main.css`.

Static files are checked before routes, so a file at `public/index.html` would shadow the `/` page route.

## Special files

| File | Purpose |
|------|---------|
| `_layout.tsx` | Wraps sibling and nested pages |
| `_404.tsx` | Rendered on 404 with a 404 status |
| `_error.tsx` | Rendered on unhandled server errors |

### `_404.tsx`

Rendered when no route matches, or when a loader returns `notFound()`. Receives the same `PageProps` as a regular page (`params` will be empty).

```tsx
// pages/_404.tsx
import type { PageProps } from "anpan";
import { Head } from "anpan";

export default function NotFound({ url }: PageProps) {
  return (
    <>
      <Head><title>Not Found</title></Head>
      <h1>404 - Page not found</h1>
      <p>{url.pathname} does not exist.</p>
      <a href="/">Go home</a>
    </>
  );
}
```

### `_error.tsx`

Rendered when an unhandled exception reaches the top-level handler. In development, the stack trace is shown directly. `_error.tsx` is only used in production (when `dev: false`).

```tsx
// pages/_error.tsx
import { Head } from "anpan";

export default function ErrorPage() {
  return (
    <>
      <Head><title>Something went wrong</title></Head>
      <h1>500 - Internal server error</h1>
      <p>Something went wrong. Please try again.</p>
    </>
  );
}
```

## Server config

```ts
interface ServerConfig {
  pagesDir?: string;             // default: "./src/pages"
  srcDir?: string;               // default: parent of pagesDir
  publicDir?: string;            // default: "./public"
  port?: number;                 // default: 3000
  hostname?: string;             // default: "0.0.0.0"
  middleware?: Middleware[];
  dev?: boolean;                 // default: NODE_ENV !== "production"
  jsxFramework?: JsxFrameworkAdapter; // React/Preact auto-detected; supply for other frameworks
}
```

## Dev server

For development, use `createDevServer`. It watches `pagesDir` for file changes and automatically reloads connected browsers via a Server-Sent Events channel at `/__dev/reload`.

```ts
import { createDevServer } from "anpan";

const server = await createDevServer({
  pagesDir: "./src/pages",
  port: 3000,
});
```

When a file changes, the server rebuilds routes and island bundles, then signals all connected browser tabs to reload. The SSE connection and reload script are injected automatically - no client-side setup required.

You can also use Bun's `--hot` flag, which restarts the server process on file changes. Combine it with `createDevServer` to get both server-level hot reload and browser tab reload:

```sh
bun run --hot src/main.ts
```

## Production build

Before deploying, pre-build the island bundles:

```sh
bun run build
```

This bundles all island components for the browser and writes output to `.anpan/islands/` (the same directory the server uses at runtime). You can also call it from code:

```ts
import { build } from "anpan";

await build({
  pagesDir: "./src/pages",
});
```

### Deploying

The server runs TypeScript directly - no separate compilation step. The minimal set of files needed in production:

```
src/           # your application source
public/        # static assets
.anpan/islands/  # built island bundles (from `bun run build`)
package.json
```

A minimal `Dockerfile`:

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY src/ src/
COPY public/ public/
COPY .anpan/ .anpan/
CMD ["bun", "run", "src/main.ts"]
```

Run `bun run build` as part of your CI pipeline before building the Docker image so that `.anpan/islands/` is present.

## Streaming

Pages stream to the client in two phases. The layout shell (including `<head>`) is sent first so the browser can start fetching CSS and other subresources. The page content follows once the page component has rendered.

This is invisible to page authors - it happens automatically for all pages.

## JSX

The framework ships its own minimal JSX runtime. Set `jsxImportSource` to `"anpan"` and TSX just works - no React required. To use React or Preact as the island renderer, set `jsxImportSource` to `"react"` or `"preact"` instead (see [Using React or Preact](#using-react-or-preact)).

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "anpan"
  }
}
```

Event handlers, boolean attributes, void elements, `className`, `htmlFor`, `dangerouslySetInnerHTML`, and fragments are all supported.

```tsx
// className maps to class, htmlFor maps to for
<label htmlFor="email" className="label">Email</label>

// boolean attributes
<input type="checkbox" checked disabled />

// raw HTML
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

// fragments
<>
  <p>one</p>
  <p>two</p>
</>
```

On the server, event handlers (`onclick`, `onchange`, etc.) are stripped from the HTML output.

## Security headers

Every response includes the following headers by default. These are safe, non-breaking defaults - override any of them via middleware if needed.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `0` |

```ts
// Example: override X-Frame-Options for a specific route via middleware
const allowIframe: Middleware = async (req, next) => {
  const res = await next(req);
  if (new URL(req.url).pathname === "/embed") {
    const headers = new Headers(res.headers);
    headers.set("X-Frame-Options", "ALLOWALL");
    return new Response(res.body, { status: res.status, headers });
  }
  return res;
};
```

## Compression

Responses with compressible content types (`text/*`, `application/json`, `application/javascript`, `application/xml`) are automatically compressed with gzip or deflate based on the client's `Accept-Encoding` header. Responses that already have a `Content-Encoding` header are left untouched.

## API reference

### `createServer(config?)`

Creates and starts the HTTP server. Returns the `Bun.serve` instance. Registers SIGTERM and SIGINT handlers for graceful shutdown.

### `createDevServer(config?)`

Same as `createServer` but enables file watching and browser hot reload via SSE. Accepts the same `ServerConfig` options.

### `build(config?)`

Bundles island components for production. Writes output to `.anpan/islands/` by default.

```ts
interface BuildConfig {
  pagesDir?: string;          // default: "./src/pages"
  outDir?: string;            // default: ".anpan" (islands written to .anpan/islands/)
  jsxFramework?: JsxFrameworkAdapter;
}
```

### `Head`

JSX component. Children are collected during rendering and injected into `<head>`.

### `notFound(body?)`

Returns a `Response` with status 404. When returned from a loader, the framework renders the `_404.tsx` page.

### `redirect(url, status?)`

Returns a redirect `Response`. Default status is `302`. Allowed: `301`, `302`, `307`, `308`.

### `cache(ttlMs, fn)`

Wraps an async function with an in-memory TTL cache. Arguments are serialized to JSON as the cache key. Cache entries are evicted lazily on the next call after expiry - no background timers. Declare at module level so the cache is shared across requests.

```ts
const getPosts = cache(30_000, async () => db.posts.findAll());
```

### `cacheFor(seconds)`

Returns `{ headers: { "Cache-Control": "public, max-age=N, stale-while-revalidate=M" } }` for spreading into a loader return value. The `stale-while-revalidate` window is `max(1, floor(seconds / 5))`.

```ts
return { data, ...cacheFor(300) };
```

### `h(type, props, ...children)`

JSX element factory. Creates a `VNode`. Normally called implicitly by the JSX transform, but can be used directly.

```ts
import { h } from "anpan";

const node = h("div", { className: "box" }, h("p", null, "Hello"));
```

### `Fragment`

Symbol used for JSX fragments (`<>...</>`). Normally used implicitly by the JSX transform.

### `renderToString(node)`

Synchronously renders a `VNode` tree to an HTML string. Handles components, fragments, HTML escaping, void elements, boolean attributes, and `className`/`htmlFor` mapping.

```ts
import { h, renderToString } from "anpan";

const html = renderToString(h("h1", null, "Hello"));
// => "<h1>Hello</h1>"
```

### `renderToStream(node)`

Returns a `ReadableStream<Uint8Array>` that emits the rendered HTML. Useful for streaming responses outside the normal page rendering pipeline.

### `JsxFrameworkAdapter`

Interface for plugging in a custom JSX framework for islands. Pass an instance to `createServer({ jsxFramework: ... })`.

```ts
interface JsxFrameworkAdapter {
  /** Render component(props) to an HTML string on the server. */
  serverRender: (component: unknown, props: Record<string, unknown>) => string;
  /**
   * JS snippet appended to each island bundle. Must export __islandMount(el, props).
   * Use __COMP__ as a placeholder for the component identifier.
   */
  clientMountSnippet: string;
}
```

React and Preact adapters are built-in and selected automatically from `jsxImportSource` in `tsconfig.json`.

### `useState(initialValue)`

Minimal state hook for island components. On the server returns `[initialValue, noop]`. In the browser manages local state and triggers re-renders. When using React or Preact islands, use those frameworks' own `useState` instead.

### Types

```ts
// Context available in loaders and passed to page/layout components
interface RouteContext<TParams = Record<string, string>> {
  params: TParams;   // extracted URL params
  url: URL;          // full request URL including search params
  req: Request;      // raw Bun Request object
}

// Props passed to every page component
type PageProps<TLoader = undefined, TParams = Record<string, string>> =
  RouteContext<TParams> & {
    data: /* inferred from TLoader */;
  };

// Props passed to layout components
interface LayoutProps extends RouteContext {
  children: VNode | null;
}

// Loader function signature
type Loader<TData = unknown, TParams = Record<string, string>> =
  (ctx: RouteContext<TParams>) => LoaderReturn<TData> | Promise<LoaderReturn<TData>>;

// Loader return value
type LoaderReturn<TData = unknown> =
  | Response
  | { data: TData; status?: number; headers?: Record<string, string> };

// Adapter for plugging in a custom JSX framework for islands
interface JsxFrameworkAdapter {
  serverRender: (component: unknown, props: Record<string, unknown>) => string;
  clientMountSnippet: string;
}

// API route handler
type ApiHandler = (
  req: Request,
  ctx: { params: Record<string, string> },
) => Response | Promise<Response>;

// Middleware function
type Middleware = (
  req: Request,
  next: Handler,
) => Response | Promise<Response>;

// Inner handler passed to middleware
type Handler = (req: Request) => Response | Promise<Response>;

// Virtual DOM node
interface VNode {
  type: string | ComponentType | symbol;
  props: Props;
  key?: string | null;
}

// Component function
type ComponentType<P = any> = (props: P) => VNode | Primitive | null;

// JSX children
type Child = Primitive | VNode | Child[];
type Primitive = string | number | boolean | null | undefined;

// Build configuration
interface BuildConfig {
  pagesDir?: string;
  outDir?: string;
  jsxFramework?: JsxFrameworkAdapter;
}

// Route definition (returned by the router)
interface Route {
  pattern: string;        // e.g. "/blog/:slug"
  filePath: string;
  type: "page" | "api" | "layout" | "error" | "notfound";
  params: string[];       // e.g. ["slug"]
  isDynamic: boolean;
  isCatchAll: boolean;
}

// Result of matching a URL to a route
interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

// Page module shape (what a page file exports)
interface PageModule {
  default: (props: PageProps) => VNode | Child | null;
  loader?: Loader;
}

// Layout module shape (what a layout file exports)
interface LayoutModule {
  default: (props: LayoutProps) => VNode | Child | null;
}
```

## Tests

```sh
bun test
```

87 tests across unit and integration suites covering the JSX runtime, router, middleware, island system, a full server, and browser hydration via Playwright.
