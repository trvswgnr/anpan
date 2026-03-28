# bun-web-framework

A small SSR framework built on [Bun](https://bun.sh). No React. No Node.js. Pages are TSX files, all rendering happens on the server, and interactive pieces are hydrated in the browser as islands.

## Requirements

- Bun >= 1.1.0

## Install

```sh
bun add bun-web-framework
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
    "jsx": "react-jsx",
    "jsxImportSource": "bun-web-framework"
  }
}
```

**src/main.ts**

```ts
import { createServer } from "bun-web-framework";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: 3000,
});

console.log(`http://localhost:${server.port}`);
```

**src/pages/index.tsx**

```tsx
import { Head } from "bun-web-framework";
import type { PageProps } from "bun-web-framework";

export default function HomePage({ params, url }: PageProps) {
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
import type { PageProps } from "bun-web-framework";

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
pages/blog/[slug].tsx        → /blog/hello-world  → params.slug = "hello-world"
pages/docs/[...path].tsx     → /docs/a/b/c        → params.path = "a/b/c"
```

Static routes always win over dynamic ones.

## Layouts

A file named `_layout.tsx` wraps all pages in the same directory and below.

```tsx
import type { LayoutProps } from "bun-web-framework";

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

`LayoutProps` contains the same fields as `PageProps` plus `children`.

## Head management

Use `<Head>` to set `<title>`, `<meta>`, and any other head elements from inside a page component. The content is collected during rendering and injected into the document `<head>` automatically.

```tsx
import { Head } from "bun-web-framework";

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
import { notFound, redirect } from "bun-web-framework";
import type { Loader } from "bun-web-framework";

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

- `{ data: T }` — the `data` prop is passed to the page component, typed via `typeof loader`
- `Response` — returned directly; use `notFound()` or `redirect()` for common cases
- `{ data: T, status: number, headers: {...} }` — data with custom status/headers

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

## API routes

Files inside `pages/api/` (or any directory) export named functions for each HTTP method.

```ts
// pages/api/users.ts
import type { ApiHandler } from "bun-web-framework";

export const GET: ApiHandler = (_req, { params }) => {
  return Response.json({ users: [] });
};

export const POST: ApiHandler = async (req, _ctx) => {
  const body = await req.json();
  return Response.json({ created: body }, { status: 201 });
};
```

The route is treated as an API route when the file is inside a directory named `api` or in a path containing `/api/`. Export `GET`, `POST`, `PUT`, `DELETE`, or `PATCH`. You can also export `default` as a fallback for any method.

## Islands

By default, every component is server-only: it renders to HTML and sends no JavaScript to the browser. An island is a component that also ships client-side JavaScript and gets hydrated in the browser.

### Defining an island

Name the file `*.island.tsx` and export a default function.

```tsx
// components/Counter.island.tsx
import { useState } from "bun-web-framework/islands";

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
3. Hydration scripts are injected into `<head>`.

In the browser, the client runtime finds each `<island-placeholder>`, imports the bundle, and mounts the live component.

### useState

`useState` inside an island works the same as it would in React in terms of API, but it is implemented with a tiny custom runtime (no React dependency).

```tsx
const [value, setValue] = useState(initialValue);
```

On the server, `useState` returns `[initialValue, noopSetter]` so the static snapshot always matches the initial state.

### Scan directory

The bundler scans `srcDir` for `.island.tsx` files. `srcDir` defaults to the parent of `pagesDir`, so `src/pages/` and `src/components/` are both covered automatically. You can override it:

```ts
createServer({ pagesDir: "./src/pages", srcDir: "./src" });
```

## Middleware

Middleware runs before every route handler. It follows the onion model: each function receives the request and a `next` function to call the next layer.

```ts
import type { Middleware } from "bun-web-framework";

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

## Server config

```ts
interface ServerConfig {
  pagesDir?: string;    // default: "./src/pages"
  srcDir?: string;      // default: parent of pagesDir
  publicDir?: string;   // default: "./public"
  port?: number;        // default: 3000
  hostname?: string;    // default: "0.0.0.0"
  middleware?: Middleware[];
  dev?: boolean;        // default: NODE_ENV !== "production"
}
```

## Dev server

For development, use `createDevServer`. It watches `pagesDir` for changes and sends a reload signal to connected browsers over SSE.

```ts
import { createDevServer } from "bun-web-framework";

const server = await createDevServer({
  pagesDir: "./src/pages",
  port: 3000,
});
```

Or with the included script:

```sh
bun run --hot src/main.ts
```

`--hot` tells Bun to reload the process on file changes. `createDevServer` injects a small script that reloads the browser tab when the server restarts.

## Production build

```sh
bun run build
```

This bundles all island components for the browser and writes an island manifest to `dist/island-manifest.json`. The server itself does not need a separate build step since Bun runs TypeScript directly.

You can also call it from code:

```ts
import { build } from "bun-web-framework";

await build({
  pagesDir: "./src/pages",
  outDir: "./dist",
});
```

## Streaming

Pages stream to the client in two chunks. The `<head>` and layout shell are sent immediately so the browser can start fetching CSS and other resources. The page body follows once the page component has rendered.

This means the browser sees something like this in order:

```
1. <!DOCTYPE html><html><head>...</head><body><nav>...</nav><main>
2. [page content]
3. </main></body></html>
```

## JSX

The framework ships its own JSX runtime. No React, no Preact. Set `jsxImportSource` in `tsconfig.json` and TSX just works.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bun-web-framework"
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

On the server, event handlers (`onclick`, `onchange`, etc.) are stripped from the output.

## API reference

### `createServer(config?)`

Creates and starts the HTTP server. Returns the `Bun.serve` instance.

### `createDevServer(config?)`

Same as `createServer` but enables file watching and browser hot reload.

### `build(config?)`

Bundles island components for production. Writes output to `outDir`.

### `Head`

JSX component. Children are collected during rendering and injected into `<head>`.

### `notFound(body?)`

Returns a `Response` with status 404. When returned from a loader, the framework renders the `_404.tsx` page.

### `redirect(url, status?)`

Returns a redirect `Response`. Default status is `302`. Allowed: `301`, `302`, `307`, `308`.

### `useState(initialValue)`

Minimal state hook for island components. On the server returns `[initialValue, noop]`. In the browser manages local state and triggers re-renders.

### Types

```ts
// Props passed to every page component
type PageProps<TLoader = undefined, TParams = Record<string, string>> = {
  params: TParams;
  url: URL;
  req: Request;
  data: // inferred from TLoader
};

// Props passed to layout components
interface LayoutProps {
  params: Record<string, string>;
  url: URL;
  req: Request;
  children: VNode | null;
}

// Loader function signature
type Loader<TData = unknown, TParams = Record<string, string>> =
  (ctx: RouteContext<TParams>) => LoaderReturn<TData> | Promise<LoaderReturn<TData>>;

// Loader return value
type LoaderReturn<TData = unknown> =
  | Response
  | { data: TData; status?: number; headers?: Record<string, string> };

// API route handler
type ApiHandler = (
  req: Request,
  ctx: { params: Record<string, string> },
) => Response | Promise<Response>;
```

## Tests

```sh
bun test
```

69 tests across unit and integration suites covering the JSX runtime, router, middleware, island system, and a full server.
