// Built-in framework adapters for React and Preact.
// Kept in a separate file to avoid circular imports between plugin.ts and bundler.ts.

import type { JsxFrameworkAdapter } from "./types.ts";

// Internal marker so the plugin can identify which built-in is in use without
// needing reference equality (which would require importing from bundler.ts).
export const BUILTIN_FRAMEWORK = Symbol("builtinFramework");

export type BuiltinFrameworkMarker = "react" | "preact";

export interface BuiltinAdapter extends JsxFrameworkAdapter {
  readonly [BUILTIN_FRAMEWORK]: BuiltinFrameworkMarker;
}

export const REACT_ADAPTER: BuiltinAdapter = {
  [BUILTIN_FRAMEWORK]: "react",
  serverRender: () => {
    throw new Error(
      "REACT_ADAPTER.serverRender should not be called directly — " +
      "the plugin injects React renderToString inline.",
    );
  },
  clientMountSnippet:
    `import{createElement as __ce__}from"react";` +
    `import{createRoot as __cr__}from"react-dom/client";` +
    `export const __islandMount=(el,props)=>__cr__(el).render(__ce__(__COMP__,props));`,
};

export const PREACT_ADAPTER: BuiltinAdapter = {
  [BUILTIN_FRAMEWORK]: "preact",
  serverRender: () => {
    throw new Error(
      "PREACT_ADAPTER.serverRender should not be called directly — " +
      "the plugin injects Preact renderToString inline.",
    );
  },
  clientMountSnippet:
    `import{h as __ph__,render as __pr__}from"preact";` +
    `export const __islandMount=(el,props)=>__pr__(__ph__(__COMP__,props),el);`,
};

export function getBuiltinFramework(adapter: JsxFrameworkAdapter): BuiltinFrameworkMarker | null {
  return (adapter as BuiltinAdapter)[BUILTIN_FRAMEWORK] ?? null;
}
