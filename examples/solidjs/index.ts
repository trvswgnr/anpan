/**
 * SolidJS example for anpan.
 *
 * Pages use anpan's JSX (`jsxImportSource: "@travvy/anpan"` in tsconfig). Island
 * components are compiled with `babel-preset-solid` via `solidIslandTransform`
 * so they use real Solid JSX (`createSignal`, `solid-js/web` hydration).
 *
 * Requires devDependencies: `@babel/core`, `@babel/preset-typescript`,
 * `babel-preset-solid`.
 *
 * Run:
 *   cd examples/solidjs && bun run dev
 */
import { createServer, type JsxFrameworkAdapter } from "@travvy/anpan";
import { renderToString } from "solid-js/web";

const solidAdapter: JsxFrameworkAdapter = {
  serverRender: (comp, props) =>
    renderToString(() => (comp as (p: Record<string, unknown>) => unknown)(props)),

  clientMountSnippet:
    `import{render as __sr__}from"solid-js/web";` +
    `export const __islandMount=(el,props)=>{` +
    `while(el.firstChild)el.removeChild(el.firstChild);` +
    `__sr__(()=>__COMP__(props),el);el.dataset.mounted="1";};`,

  solidIslandTransform: true,
};

const server = await createServer({
  pagesDir: "./pages",
  port: parseInt(process.env.PORT ?? "3004"),
  jsxFramework: solidAdapter,
});

console.log(`SolidJS example running at ${server.url}`);
