// Browser-side stub for "bun-web-framework/islands".
// Resolved when Bun.build() uses target: "browser" or the "browser" condition.
//
// island() is an identity function in the browser — the component is used
// directly by the hydration runtime. The server wrapper is not needed.
//
// useState comes from client-runtime so all islands share the same reactive
// state slots set up by mount().

export function island<P>(
  component: (props: P) => unknown,
  _filePath?: string,
  _exportName?: string,
): (props: P) => unknown {
  return component;
}

export { useState, h, Fragment } from "./client-runtime.ts";
