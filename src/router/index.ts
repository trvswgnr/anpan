import { join, relative, sep } from "node:path";
import type { Route, RouteMatch, RouteType } from "./types.ts";

// Route scanning - discover all page/api/layout/special files

export async function scanRoutes(pagesDir: string): Promise<Route[]> {
  const glob = new Bun.Glob("**/*.{ts,tsx}");
  const routes: Route[] = [];

  for await (const file of glob.scan({ cwd: pagesDir, onlyFiles: true })) {
    const filePath = join(pagesDir, file);
    const route = filePathToRoute(file, filePath);
    if (route) routes.push(route);
  }

  return sortRoutes(routes);
}

// Convert a relative file path (from pagesDir) to a Route descriptor

function filePathToRoute(relPath: string, absolutePath: string): Route | null {
  // Normalize to forward slashes
  const normalized = relPath.split(sep).join("/");

  // Strip extension
  const withoutExt = normalized.replace(/\.(tsx?|jsx?)$/, "");

  // Determine route type from filename
  const fileName = withoutExt.split("/").at(-1) ?? "";

  let type: RouteType;
  if (fileName === "_layout") {
    type = "layout";
  } else if (fileName === "_error") {
    type = "error";
  } else if (fileName === "_404") {
    type = "notfound";
  } else if (withoutExt.startsWith("api/") || withoutExt.includes("/api/")) {
    type = "api";
  } else {
    type = "page";
  }

  // Build URL pattern from file path segments
  const { pattern, params, isDynamic, isCatchAll } = buildPattern(withoutExt);

  return {
    pattern,
    filePath: absolutePath,
    type,
    params,
    isDynamic,
    isCatchAll,
  };
}

function buildPattern(withoutExt: string): {
  pattern: string;
  params: string[];
  isDynamic: boolean;
  isCatchAll: boolean;
} {
  const params: string[] = [];
  let isCatchAll = false;
  let isDynamic = false;

  const segments = withoutExt.split("/").map((seg) => {
    // Catch-all: [...rest]
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const name = seg.slice(4, -1);
      params.push(name);
      isDynamic = true;
      isCatchAll = true;
      return `*${name}`;
    }
    // Dynamic: [slug]
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const name = seg.slice(1, -1);
      params.push(name);
      isDynamic = true;
      return `:${name}`;
    }
    return seg;
  });

  // index -> /
  if (segments.at(-1) === "index") {
    segments.pop();
  }

  const pattern = "/" + segments.join("/");

  return { pattern: pattern === "//" ? "/" : pattern, params, isDynamic, isCatchAll };
}

// Route matching

export function matchRoute(
  routes: Route[],
  pathname: string,
): RouteMatch | null {
  // Normalize trailing slash (except root)
  const path = pathname !== "/" && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

  for (const route of routes) {
    if (route.type === "layout" || route.type === "error") continue;
    const params = matchPattern(route.pattern, path);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}

function matchPattern(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  // Catch-all: last segment starts with *
  const lastPat = patternParts.at(-1) ?? "";
  if (lastPat.startsWith("*")) {
    const paramName = lastPat.slice(1);
    if (pathParts.length < patternParts.length - 1) return null;
    // Match all leading segments
    for (let i = 0; i < patternParts.length - 1; i++) {
      if (!matchSegment(patternParts[i]!, pathParts[i], params)) return null;
    }
    params[paramName] = pathParts.slice(patternParts.length - 1).join("/");
    return params;
  }

  if (patternParts.length !== pathParts.length) return null;

  for (let i = 0; i < patternParts.length; i++) {
    if (!matchSegment(patternParts[i]!, pathParts[i], params)) return null;
  }

  return params;
}

function matchSegment(
  pat: string,
  seg: string | undefined,
  params: Record<string, string>,
): boolean {
  if (seg === undefined) return false;
  if (pat.startsWith(":")) {
    try {
      params[pat.slice(1)] = decodeURIComponent(seg);
    } catch {
      return false; // malformed percent-encoding - reject this route match
    }
    return true;
  }
  return pat === seg;
}

// Sort routes: static -> dynamic -> catch-all (within each: alphabetical)

function routeScore(r: Route): number {
  if (r.isCatchAll) return 2;
  if (r.isDynamic) return 1;
  return 0;
}

function sortRoutes(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const scoreDiff = routeScore(a) - routeScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.pattern.localeCompare(b.pattern);
  });
}

// Find layouts that apply to a given route (nearest first, then parent)

export function findLayouts(routes: Route[], route: Route): Route[] {
  const layouts: Route[] = [];
  const routeDir = route.filePath.split("/").slice(0, -1).join("/");

  for (const r of routes) {
    if (r.type !== "layout") continue;
    const layoutDir = r.filePath.split("/").slice(0, -1).join("/");
    // Layout applies if it's in the same dir or a parent dir of the route
    if (routeDir.startsWith(layoutDir)) {
      layouts.push(r);
    }
  }

  // Sort: deepest layout first (closest to the page)
  layouts.sort((a, b) => b.filePath.length - a.filePath.length);
  return layouts;
}
