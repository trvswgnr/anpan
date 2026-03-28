export type Primitive = string | number | boolean | null | undefined;

export type Child = Primitive | VNode | Child[];

export interface VNode {
  type: string | ComponentType | symbol;
  props: Props;
  key?: string | null;
}

export type Props = Record<string, unknown> & { children?: Child | Child[] };

export type ComponentType<P extends Props = Props> = (props: P) => VNode | Child | null;

// JSX intrinsic element types (subset — extend as needed)
export type HTMLTag = keyof HTMLElementTagNameMap | string;

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
