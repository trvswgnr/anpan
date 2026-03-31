/**
 * SolidJS example for anpan.
 *
 * This example demonstrates using solid-js alongside anpan. Pages are
 * rendered with anpan's JSX runtime (jsxImportSource: "@travvy/anpan" in tsconfig),
 * and island components use anpan's built-in useState for client reactivity.
 *
 * solid-js is available as a dependency and can be used for its non-JSX APIs
 * (stores, context, resources, etc.) in both server and client code.
 *
 * Note: Full SolidJS reactive JSX (fine-grained DOM updates) requires the
 * SolidJS JSX transform (bun-plugin-solid). Without it, anpan's JSX runtime
 * is used and anpan's built-in island reconciler handles client hydration.
 *
 * Run:
 *   cd examples/solidjs && bun run dev
 */
import {
  createServer,
  renderToString,
  type JsxFrameworkAdapter,
} from "@travvy/anpan";

const solidAdapter: JsxFrameworkAdapter = {
  /**
   * Server-side: render the island component to an HTML string using
   * anpan's renderToString (since islands use anpan's JSX runtime).
   */
  serverRender: (comp, props) =>
    renderToString(
      (comp as (p: Record<string, unknown>) => unknown)(props),
    ),

  /**
   * Client-side: empty snippet - let anpan's built-in island reconciler
   * handle mounting. The reconciler calls component(props) and diffs the
   * returned VNode tree against the DOM, re-rendering on state changes.
   */
  clientMountSnippet: "",
};

const server = await createServer({
  pagesDir: "./pages",
  port: parseInt(process.env.PORT ?? "3004"),
  jsxFramework: solidAdapter,
});

console.log(`SolidJS example running at ${server.url}`);
