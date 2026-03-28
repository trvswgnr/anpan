// This file is bundled for the browser by Bun.build().
// It provides the client-side hydration runtime and a minimal useState hook.
//
// Injected into every page that contains islands via:
//   <script type="module" src="/_islands/__runtime.js"></script>

// ---------------------------------------------------------------------------
// Minimal reactive state (no React, no VDOM)
// ---------------------------------------------------------------------------

type Setter<T> = (newVal: T | ((prev: T) => T)) => void;
type StateSlot<T> = { value: T; listeners: Set<() => void> };

// Each island instance gets its own state store keyed by slot index.
// We use a per-instance cursor approach — same as React's rules of hooks.
let currentSlots: StateSlot<unknown>[] | null = null;
let currentSlotIdx = 0;

export function useState<T>(initial: T): [T, Setter<T>] {
  if (!currentSlots) {
    throw new Error("useState called outside of island render context");
  }
  const idx = currentSlotIdx++;
  if (currentSlots[idx] === undefined) {
    currentSlots[idx] = { value: initial, listeners: new Set() };
  }
  const slot = currentSlots[idx] as StateSlot<T>;

  const setter: Setter<T> = (newValOrUpdater) => {
    const next =
      typeof newValOrUpdater === "function"
        ? (newValOrUpdater as (prev: T) => T)(slot.value)
        : newValOrUpdater;
    if (next === slot.value) return;
    slot.value = next;
    for (const listener of slot.listeners) listener();
  };

  return [slot.value, setter];
}

// ---------------------------------------------------------------------------
// Minimal h() and Fragment for the browser (mirrors server runtime)
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

interface VNode {
  type: string | ((props: Record<string, unknown>) => VNode | string | null);
  props: Record<string, unknown>;
}

type Child = string | number | boolean | null | undefined | VNode | Child[];

export function h(
  type: VNode["type"],
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode {
  const p = props ?? {};
  if (children.length === 1) p.children = children[0];
  else if (children.length > 1) p.children = children;
  return { type, props: p };
}

export const Fragment = Symbol("Fragment");

// ---------------------------------------------------------------------------
// DOM reconciler — diffs VNode tree against real DOM
// ---------------------------------------------------------------------------

function renderToDom(node: unknown, parent: Element | DocumentFragment): void {
  if (node === null || node === undefined || node === false) return;
  if (typeof node === "string" || typeof node === "number") {
    parent.appendChild(document.createTextNode(String(node)));
    return;
  }
  if (typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) renderToDom(child, parent);
    return;
  }

  const vnode = node as VNode;

  if ((vnode.type as unknown as symbol) === Fragment) {
    renderToDom(vnode.props.children, parent);
    return;
  }

  if (typeof vnode.type === "function") {
    const result = vnode.type(vnode.props);
    renderToDom(result, parent);
    return;
  }

  const el = document.createElement(vnode.type as string);

  for (const [key, val] of Object.entries(vnode.props)) {
    if (key === "children") continue;
    if (key === "dangerouslySetInnerHTML" && val && typeof val === "object") {
      el.innerHTML = (val as { __html: string }).__html;
      continue;
    }
    if (key.startsWith("on") && typeof val === "function") {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, val as EventListener);
      continue;
    }
    if (key === "className") { el.className = String(val); continue; }
    if (key === "htmlFor") { (el as HTMLLabelElement).htmlFor = String(val); continue; }
    if (val === true) { el.setAttribute(key.toLowerCase(), ""); continue; }
    if (val === false || val === null || val === undefined) { el.removeAttribute(key.toLowerCase()); continue; }
    el.setAttribute(key.toLowerCase(), String(val));
  }

  if (!(vnode.type as string in VOID_TAGS)) {
    renderToDom(vnode.props.children, el);
  }

  parent.appendChild(el);
}

// ---------------------------------------------------------------------------
// Mount — replaces placeholder with live component
// ---------------------------------------------------------------------------

function mount(
  component: (props: Record<string, unknown>) => VNode | null,
  props: Record<string, unknown>,
  placeholder: HTMLElement,
): void {
  const slots: StateSlot<unknown>[] = [];

  function render() {
    // Activate state context
    currentSlots = slots;
    currentSlotIdx = 0;

    const vnode = component(props);

    currentSlots = null;
    currentSlotIdx = 0;

    // Register render on all slots after each render (including newly created ones).
    // Set.add() is idempotent so no dedup needed.
    for (const slot of slots) {
      slot.listeners.add(render);
    }

    // Build new DOM
    const fragment = document.createDocumentFragment();
    renderToDom(vnode, fragment);

    // Replace existing content
    if (placeholder.parentElement) {
      placeholder.innerHTML = "";
      placeholder.appendChild(fragment);
      placeholder.dataset.mounted = "1";
    }
  }

  render();
}

// ---------------------------------------------------------------------------
// Hydration bootstrap — runs on DOMContentLoaded
// ---------------------------------------------------------------------------

type IslandModule = { default: (props: Record<string, unknown>) => VNode | null };

async function hydrate(): Promise<void> {
  const placeholders = document.querySelectorAll<HTMLElement>("island-placeholder");

  await Promise.all(
    Array.from(placeholders).map(async (el) => {
      const bundleUrl = el.dataset.bundle;
      const propsRaw = el.dataset.props ?? "{}";

      if (!bundleUrl) return;

      let props: Record<string, unknown>;
      try {
        props = JSON.parse(propsRaw);
      } catch {
        props = {};
      }

      try {
        const mod = await import(/* @vite-ignore */ bundleUrl) as IslandModule;
        if (typeof mod.default === "function") {
          mount(mod.default, props, el);
        }
      } catch (err) {
        console.error(`[islands] Failed to hydrate island at ${bundleUrl}:`, err);
      }
    }),
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrate);
} else {
  hydrate();
}
