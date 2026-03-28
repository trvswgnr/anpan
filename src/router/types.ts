export type RouteType = "page" | "api" | "layout" | "error" | "notfound";

export interface Route {
  /** URL pattern, e.g. "/blog/:slug" */
  pattern: string;
  /** Absolute path to the source file */
  filePath: string;
  type: RouteType;
  /** Extracted param names, e.g. ["slug"] */
  params: string[];
  isDynamic: boolean;
  /** true for catch-all routes like /[...rest] */
  isCatchAll: boolean;
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

export interface RouteContext<TParams extends Record<string, string> = Record<string, string>> {
  params: TParams;
  url: URL;
  req: Request;
}

// ---------------------------------------------------------------------------
// Loader — async data fetching run before the page component renders.
// Returning a Response short-circuits rendering (redirect, notFound, etc.).
// Returning { data } passes typed data to the page component.
// ---------------------------------------------------------------------------

export type LoaderReturn<TData = unknown> =
  | Response
  | { data: TData; status?: number; headers?: Record<string, string> };

export type Loader<TData = unknown, TParams extends Record<string, string> = Record<string, string>> =
  (ctx: RouteContext<TParams>) => LoaderReturn<TData> | Promise<LoaderReturn<TData>>;
