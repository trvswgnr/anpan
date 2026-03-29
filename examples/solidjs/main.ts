/**
 * SolidJS example for bun-web-framework.
 *
 * SolidJS is NOT auto-detected from tsconfig.json (only React and Preact are
 * built-in). You must supply an explicit `jsxFramework` adapter with:
 *
 *   - `serverRender`: calls `solid-js/web`'s `renderToString` for SSR
 *   - `clientMountSnippet`: appended to each island bundle; must export
 *     `__islandMount(el, props)` using `solid-js/web`'s `render`
 *
 * IMPORTANT — JSX transform:
 *   SolidJS JSX is NOT standard React-style JSX. It compiles to reactive
 *   DOM primitives instead of `createElement` calls. You need a dedicated
 *   transform plugin:
 *
 *     bun add -d bun-plugin-solid
 *
 *   Then register it in your Bun config or pass it to `Bun.build()`.
 *   Without the transform, JSX produces React elements that SolidJS cannot
 *   hydrate correctly.
 *
 * Run (after bun install):
 *   cd examples/solidjs && bun install && bun run dev
 */
import { renderToString } from "solid-js/web";
import { createServer } from "../../src/index.ts";
import type { JsxFrameworkAdapter } from "../../src/islands/bundler.ts";

const solidAdapter: JsxFrameworkAdapter = {
  /**
   * Server-side: render the island component to an HTML string using
   * SolidJS's streaming-capable `renderToString`.
   */
  serverRender: (comp, props) =>
    renderToString(() => (comp as (p: unknown) => unknown)(props) as any),

  /**
   * Client-side: appended verbatim to each island bundle by the bundler.
   * `__COMP__` is replaced with the actual component reference at build time.
   * Must export `__islandMount(el, props)`.
   */
  clientMountSnippet:
    `import{render as __sr__}from"solid-js/web";` +
    `export const __islandMount=(el,props)=>__sr__(()=>__COMP__(props),el);`,
};

const server = await createServer({
  pagesDir: "./examples/solidjs/pages",
  port: 3004,
  jsxFramework: solidAdapter,
});

console.log(`SolidJS example running at ${server.url}`);
