/**
 * Adapter for using a custom JSX framework (React, Preact, Solid, etc.) with
 * the islands system. Pass to `createServer({ jsxFramework: ... })`.
 *
 * React and Preact are detected automatically from `jsxImportSource` in
 * `tsconfig.json` — no adapter needed for those. Use this for anything else.
 */
export interface JsxFrameworkAdapter {
  /**
   * Server-side: render `component` with `props` to a static HTML string.
   * Called once per island per SSR request to produce the initial snapshot.
   *
   * @example React
   *   serverRender: (comp, props) =>
   *     ReactDOMServer.renderToString(React.createElement(comp as any, props))
   */
  serverRender: (component: unknown, props: Record<string, unknown>) => string;

  /**
   * A JS code snippet that is appended to each island bundle in browser mode.
   * It **must** export a named function `__islandMount`:
   *   `(el: HTMLElement, props: Record<string, unknown>) => void`
   *
   * Use `__COMP__` as a placeholder — it is replaced with the actual component
   * identifier extracted from the island file's default export.
   *
   * @example Solid.js
   *   clientMountSnippet:
   *     `import{render as __sr__}from"solid-js/web";` +
   *     `export const __islandMount=(el,props)=>__sr__(()=>__COMP__(props),el);`
   */
  clientMountSnippet: string;
}

export interface IslandMeta {
  /** Stable hash derived from the component's file path + export name */
  id: string;
  /** Absolute path to the source file */
  filePath: string;
  /** Export name, usually "default" */
  exportName: string;
  /** URL path where the client bundle is served, e.g. /_islands/counter-abc123.js */
  bundleUrl: string;
}

export type IslandManifest = Map<string, IslandMeta>;
