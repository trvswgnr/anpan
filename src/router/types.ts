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

export interface RouteContext {
  params: Record<string, string>;
  url: URL;
  req: Request;
}
