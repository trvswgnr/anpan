import type { Child, ComponentType, Props, VNode } from "./types.ts";

export const FRAGMENT = Symbol("Fragment");

// ---------------------------------------------------------------------------
// VNode creation
// ---------------------------------------------------------------------------

/**
 * Create a virtual DOM node. This is the JSX factory function.
 *
 * You rarely call this directly. TSX compiles `<div>` to `h("div", ...)` for
 * you when `jsxImportSource` is set to `"bun-web-framework"` in tsconfig.
 */
export function h(
  type: string | ComponentType | symbol,
  props: Props | null,
  ...children: Child[]
): VNode {
  const normalizedProps: Props = props ?? {};
  if (children.length === 1) {
    normalizedProps.children = children[0];
  } else if (children.length > 1) {
    normalizedProps.children = children;
  }
  return { type, props: normalizedProps };
}

export const Fragment = FRAGMENT;

// ---------------------------------------------------------------------------
// HTML serialization helpers
// ---------------------------------------------------------------------------

// Tags that must not have a closing tag
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// Attributes that should be rendered as boolean (present = true)
const BOOLEAN_ATTRS = new Set([
  "allowfullscreen", "async", "autofocus", "autoplay", "checked",
  "controls", "default", "defer", "disabled", "formnovalidate",
  "hidden", "ismap", "loop", "multiple", "muted", "nomodule",
  "novalidate", "open", "readonly", "required", "reversed",
  "selected", "typemustmatch",
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeAttr(name: string, value: unknown): string {
  // Map React-style prop names to HTML attribute names
  const attrName = propToAttr(name);

  if (value === false || value === null || value === undefined) return "";
  if (BOOLEAN_ATTRS.has(attrName)) return value ? ` ${attrName}` : "";
  if (value === true) return ` ${attrName}`;
  return ` ${attrName}="${escapeHtml(String(value))}"`;
}

function propToAttr(name: string): string {
  switch (name) {
    case "className": return "class";
    case "htmlFor": return "for";
    case "httpEquiv": return "http-equiv";
    case "tabIndex": return "tabindex";
    case "crossOrigin": return "crossorigin";
    case "cellPadding": return "cellpadding";
    case "cellSpacing": return "cellspacing";
    case "colSpan": return "colspan";
    case "rowSpan": return "rowspan";
    case "contentEditable": return "contenteditable";
    case "spellCheck": return "spellcheck";
    case "autoComplete": return "autocomplete";
    case "autoFocus": return "autofocus";
    case "autoPlay": return "autoplay";
    case "encType": return "enctype";
    case "noValidate": return "novalidate";
    case "useMap": return "usemap";
    case "viewBox": return "viewBox"; // SVG — case-sensitive
    default: return name.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Synchronous render to string
// ---------------------------------------------------------------------------

/**
 * Render a VNode tree to an HTML string. Synchronous.
 *
 * Used internally by the renderer and by island() to produce server snapshots.
 * You can also call it directly if you need a string for something outside the
 * normal request/response cycle.
 */
export function renderToString(node: unknown): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node === "number") return String(node);
  if (typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(renderToString).join("");

  const vnode = node as VNode;

  // Fragment
  if (vnode.type === FRAGMENT || vnode.type === null) {
    return renderToString(vnode.props.children);
  }

  // Component
  if (typeof vnode.type === "function") {
    const result = (vnode.type as ComponentType)(vnode.props);
    return renderToString(result);
  }

  // Special content marker — emits the sentinel string used by the renderer
  // to split the layout shell into before/after the page content.
  if (vnode.type === "__bwfw_content_marker__") {
    return "<!--_BWFW_CONTENT_-->";
  }

  if (typeof vnode.type !== "string") return "";

  const tag = vnode.type;
  const { children, dangerouslySetInnerHTML, ...rest } = vnode.props as Props & {
    dangerouslySetInnerHTML?: { __html: string };
  };

  // Build attribute string (skip event handlers and non-serializable values)
  let attrs = "";
  for (const [key, val] of Object.entries(rest)) {
    if (key.startsWith("on") && typeof val === "function") continue;
    if (key === "key" || key === "ref") continue;
    attrs += serializeAttr(key, val);
  }

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrs}>`;
  }

  const inner = dangerouslySetInnerHTML
    ? dangerouslySetInnerHTML.__html
    : renderToString(children);

  return `<${tag}${attrs}>${inner}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Streaming render — yields HTML chunks as Uint8Array
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Render a VNode tree to a ReadableStream of UTF-8 chunks.
 *
 * The framework uses this to build the streaming page response. Each node
 * emits one or more chunks as it is visited, so large pages can begin
 * reaching the browser before the full tree is serialized.
 */
export function renderToStream(node: unknown): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        renderNodeToController(node, controller);
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

function enqueue(controller: ReadableStreamDefaultController<Uint8Array>, str: string) {
  if (str) controller.enqueue(encoder.encode(str));
}

function renderNodeToController(
  node: unknown,
  controller: ReadableStreamDefaultController<Uint8Array>,
): void {
  if (node === null || node === undefined || node === false) return;
  if (typeof node === "string") { enqueue(controller, escapeHtml(node)); return; }
  if (typeof node === "number") { enqueue(controller, String(node)); return; }
  if (typeof node === "boolean") return;

  if (Array.isArray(node)) {
    for (const child of node) renderNodeToController(child, controller);
    return;
  }

  const vnode = node as VNode;

  if (vnode.type === FRAGMENT || vnode.type === null) {
    renderNodeToController(vnode.props.children, controller);
    return;
  }

  if (typeof vnode.type === "function") {
    const result = (vnode.type as ComponentType)(vnode.props);
    renderNodeToController(result, controller);
    return;
  }

  if (typeof vnode.type !== "string") return;

  const tag = vnode.type;
  const { children, dangerouslySetInnerHTML, ...rest } = vnode.props as Props & {
    dangerouslySetInnerHTML?: { __html: string };
  };

  let attrs = "";
  for (const [key, val] of Object.entries(rest)) {
    if (key.startsWith("on") && typeof val === "function") continue;
    if (key === "key" || key === "ref") continue;
    attrs += serializeAttr(key, val);
  }

  if (VOID_TAGS.has(tag)) {
    enqueue(controller, `<${tag}${attrs}>`);
    return;
  }

  enqueue(controller, `<${tag}${attrs}>`);

  if (dangerouslySetInnerHTML) {
    enqueue(controller, dangerouslySetInnerHTML.__html);
  } else {
    renderNodeToController(children, controller);
  }

  enqueue(controller, `</${tag}>`);
}
