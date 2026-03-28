import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { matchRoute, findLayouts } from "../index.ts";
import type { Route } from "../types.ts";

// ---------------------------------------------------------------------------
// matchRoute tests — uses pre-built route fixtures (no file I/O needed)
// ---------------------------------------------------------------------------

function makeRoute(pattern: string, type: Route["type"] = "page"): Route {
  const params: string[] = [];
  let isDynamic = false;
  let isCatchAll = false;
  for (const seg of pattern.split("/")) {
    if (seg.startsWith(":")) { params.push(seg.slice(1)); isDynamic = true; }
    if (seg.startsWith("*")) { params.push(seg.slice(1)); isDynamic = true; isCatchAll = true; }
  }
  return { pattern, filePath: `/pages${pattern || "/index"}.tsx`, type, params, isDynamic, isCatchAll };
}

const routes: Route[] = [
  makeRoute("/"),
  makeRoute("/about"),
  makeRoute("/blog"),
  makeRoute("/blog/:slug"),
  makeRoute("/blog/:slug/comments"),
  makeRoute("/docs/*rest"),
  makeRoute("/api/users", "api"),
  makeRoute("/_layout", "layout"),
  makeRoute("/_404", "notfound"),
];

describe("matchRoute", () => {
  test("matches root path", () => {
    const m = matchRoute(routes, "/");
    expect(m).not.toBeNull();
    expect(m!.route.pattern).toBe("/");
    expect(m!.params).toEqual({});
  });

  test("matches static path", () => {
    const m = matchRoute(routes, "/about");
    expect(m!.route.pattern).toBe("/about");
  });

  test("matches dynamic segment and extracts param", () => {
    const m = matchRoute(routes, "/blog/hello-world");
    expect(m!.route.pattern).toBe("/blog/:slug");
    expect(m!.params).toEqual({ slug: "hello-world" });
  });

  test("matches nested dynamic route", () => {
    const m = matchRoute(routes, "/blog/my-post/comments");
    expect(m!.route.pattern).toBe("/blog/:slug/comments");
    expect(m!.params).toEqual({ slug: "my-post" });
  });

  test("matches catch-all route", () => {
    const m = matchRoute(routes, "/docs/getting-started/installation");
    expect(m!.route.pattern).toBe("/docs/*rest");
    expect(m!.params).toEqual({ rest: "getting-started/installation" });
  });

  test("matches API route", () => {
    const m = matchRoute(routes, "/api/users");
    expect(m!.route.type).toBe("api");
  });

  test("returns null for unmatched paths", () => {
    expect(matchRoute(routes, "/does-not-exist")).toBeNull();
  });

  test("ignores layout routes during matching", () => {
    const m = matchRoute(routes, "/_layout");
    // _layout should not match as a page
    expect(m).toBeNull();
  });

  test("normalizes trailing slashes", () => {
    const m = matchRoute(routes, "/about/");
    expect(m!.route.pattern).toBe("/about");
  });

  test("URL-decodes params", () => {
    const m = matchRoute(routes, "/blog/hello%20world");
    expect(m!.params.slug).toBe("hello world");
  });
});

describe("findLayouts", () => {
  const pagesDir = "/app/src/pages";
  const layoutRoutes: Route[] = [
    { pattern: "/", filePath: `${pagesDir}/_layout.tsx`, type: "layout", params: [], isDynamic: false, isCatchAll: false },
    { pattern: "/blog", filePath: `${pagesDir}/blog/_layout.tsx`, type: "layout", params: [], isDynamic: false, isCatchAll: false },
    { pattern: "/blog/:slug", filePath: `${pagesDir}/blog/[slug].tsx`, type: "page", params: ["slug"], isDynamic: true, isCatchAll: false },
    { pattern: "/about", filePath: `${pagesDir}/about.tsx`, type: "page", params: [], isDynamic: false, isCatchAll: false },
  ];

  test("finds root layout for top-level page", () => {
    const aboutRoute = layoutRoutes.find((r) => r.pattern === "/about")!;
    const layouts = findLayouts(layoutRoutes, aboutRoute);
    expect(layouts.length).toBe(1);
    expect(layouts[0]!.filePath).toContain("_layout.tsx");
  });

  test("finds both layouts for nested page (closest first)", () => {
    const blogPost = layoutRoutes.find((r) => r.pattern === "/blog/:slug")!;
    const layouts = findLayouts(layoutRoutes, blogPost);
    expect(layouts.length).toBe(2);
    expect(layouts[0]!.filePath).toContain("blog/_layout.tsx");
    expect(layouts[1]!.filePath).toContain("pages/_layout.tsx");
  });
});
