// Public API for bun-web-framework
// ============================================================

// Server
export { createServer } from "./server/index.ts";
export type { ServerConfig, ApiHandler } from "./server/index.ts";

// Dev server
export { createDevServer } from "./dev/index.ts";

// Build
export { build } from "./build/index.ts";
export type { BuildConfig } from "./build/index.ts";

// Routing types
export type { Route, RouteMatch, RouteContext, Loader, LoaderReturn } from "./router/types.ts";

// Response helpers
export { notFound, redirect } from "./helpers.ts";

// Renderer types
export type { PageProps, LayoutProps, PageModule, LayoutModule } from "./renderer/index.ts";

// Head component
export { Head } from "./renderer/head.ts";

// Middleware
export type { Middleware, Handler } from "./middleware/index.ts";

// JSX runtime (re-exported for convenience)
export { h, Fragment, renderToString, renderToStream } from "./jsx/runtime.ts";
export type { VNode, Child, ComponentType, Props } from "./jsx/types.ts";
