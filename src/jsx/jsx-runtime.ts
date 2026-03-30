// Required by the TypeScript JSX transform when jsxImportSource is set.
// The compiler imports { jsx, jsxs, Fragment } from "<jsxImportSource>/jsx-runtime".
// jsx/jsxs receive (type, props, key?) - children are already in props.children.
import { h, FRAGMENT } from "./runtime.ts";
import type { ComponentType, Props, VNode } from "./types.ts";

export { FRAGMENT as Fragment } from "./runtime.ts";
export type { VNode } from "./types.ts";

export function jsx(
  type: string | ComponentType | symbol,
  props: Props | null,
  _key?: string | null,
): VNode {
  return h(type, props);
}

export { jsx as jsxs };
