import { renderToString } from "../jsx/runtime.ts";
import type { VNode, Child } from "../jsx/types.ts";

// HeadContext - collected during a single render pass

export interface HeadEntry {
  type: "title" | "meta" | "link" | "script" | "style" | "raw";
  content: string; // serialized HTML for this entry
  key?: string;    // for deduplication (e.g. meta[name], link[rel])
}

export class HeadContext {
  private entries: HeadEntry[] = [];

  collect(nodes: Child | Child[]): void {
    const items = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of items) {
      this.collectNode(node);
    }
  }

  private collectNode(node: unknown): void {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const child of node) this.collectNode(child);
      return;
    }

    const vnode = node as VNode;
    if (typeof vnode !== "object" || !("type" in vnode)) return;

    if (typeof vnode.type === "string") {
      const tag = vnode.type;
      const html = renderToString(vnode);

      let type: HeadEntry["type"] = "raw";
      let key: string | undefined;

      if (tag === "title") {
        type = "title";
        key = "title"; // always deduplicated - last wins
      } else if (tag === "meta") {
        type = "meta";
        const props = vnode.props as Record<string, unknown>;
        key = props.name
          ? `meta:name:${props.name}`
          : props.property
          ? `meta:property:${props.property}`
          : props.charset
          ? `meta:charset`
          : undefined;
      } else if (tag === "link") {
        type = "link";
        const props = vnode.props as Record<string, unknown>;
        key = props.rel && props.href ? `link:${props.rel}:${props.href}` : undefined;
      } else if (tag === "script") {
        type = "script";
      } else if (tag === "style") {
        type = "style";
      }

      // If key exists and we already have an entry with that key, replace it
      if (key !== undefined) {
        const existing = this.entries.findIndex((e) => e.key === key);
        if (existing >= 0) {
          this.entries[existing] = { type, content: html, key };
          return;
        }
      }

      this.entries.push({ type, content: html, key });
    }

    // Recurse through fragments/arrays
    if (vnode.props?.children) {
      this.collectNode(vnode.props.children);
    }
  }

  /** Returns all collected entries as a single HTML string. */
  serialize(): string {
    return this.entries.map((e) => e.content).join("\n    ");
  }

  reset(): void {
    this.entries = [];
  }
}

// AsyncLocalStorage-based context so <Head> can register from anywhere

import { AsyncLocalStorage } from "node:async_hooks";

const headStorage = new AsyncLocalStorage<HeadContext>();

export function getHeadContext(): HeadContext | undefined {
  return headStorage.getStore();
}

export function runWithHeadContext<T>(ctx: HeadContext, fn: () => T): T {
  return headStorage.run(ctx, fn);
}

// <Head> component - registers children into the nearest HeadContext

import type { Props } from "../jsx/types.ts";
import { FRAGMENT } from "../jsx/runtime.ts";

/**
 * Collect head elements from inside a page or layout component.
 *
 * Children are not rendered inline. Instead they are injected into the
 * document `<head>` by the renderer after the page finishes rendering.
 *
 * Deduplication rules:
 * - `<title>`: last one wins.
 * - `<meta name="...">`: deduplicated by name.
 * - `<meta property="...">`: deduplicated by property.
 * - Everything else: appended in order.
 *
 * @example
 * ```tsx
 * <Head>
 *   <title>My page</title>
 *   <meta name="description" content="..." />
 * </Head>
 * ```
 */
export function Head({ children }: Props): null {
  const ctx = getHeadContext();
  if (ctx && children !== undefined) {
    ctx.collect(children as Child);
  }
  // Renders nothing inline - content is injected via HTMLRewriter
  return null;
}
