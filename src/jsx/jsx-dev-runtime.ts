// Required by the TypeScript JSX transform in development mode.
// The jsxDEV signature differs from jsx: it receives extra args (key, isStaticChildren, source, self)
// that must NOT be passed to h() as children.
import { h, FRAGMENT } from "./runtime.ts";
import type { ComponentType, Props, VNode } from "./types.ts";

export { FRAGMENT as Fragment } from "./runtime.ts";
export type { VNode } from "./types.ts";

export function jsxDEV(
  type: string | ComponentType | symbol,
  props: Props | null,
  _key?: string | null,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): VNode {
  // Drop the extra jsxDEV args; children are already in props.children
  return h(type, props);
}
