import type { Child, Primitive, VNode } from "./types.ts";

/**
 * JSX namespace for anpan's own TSX (`jsxImportSource: "anpan"`).
 * Kept separate from `types.ts` so apps using React/Preact `jsxImportSource`
 * can import `PageProps` and other API types without merging this global.
 */
declare global {
  namespace JSX {
    type Element = VNode | Primitive | null;

    interface ElementChildrenAttribute {
      children: object;
    }

    interface IntrinsicElements {
      [tag: string]: Record<string, unknown> & { children?: Child | Child[] };
    }
  }
}

export {};
