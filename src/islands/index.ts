import { createHash } from "node:crypto";
import { renderToString as builtinRenderToString } from "../jsx/runtime.ts";
import type { ComponentType } from "../jsx/types.ts";
import type { IslandManifest, IslandMeta, JsxFrameworkAdapter } from "./types.ts";
import { AsyncLocalStorage } from "node:async_hooks";

export type { IslandManifest, IslandMeta } from "./types.ts";
export type { JsxFrameworkAdapter } from "./types.ts";

// ---------------------------------------------------------------------------
// Island registry — per-request context
// ---------------------------------------------------------------------------

const islandStorage = new AsyncLocalStorage<IslandRegistry>();

export function getIslandRegistry(): IslandRegistry | undefined {
  return islandStorage.getStore();
}

export function runWithIslandRegistry<T>(reg: IslandRegistry, fn: () => T): T {
  return islandStorage.run(reg, fn);
}

export class IslandRegistry {
  /** Islands encountered during this render, by id */
  readonly encountered = new Map<string, IslandMeta>();
  /** Full manifest (populated from bundler at startup) */
  readonly manifest: IslandManifest;

  constructor(manifest: IslandManifest) {
    this.manifest = manifest;
  }

  register(id: string): IslandMeta | undefined {
    const meta = this.manifest.get(id);
    if (meta) this.encountered.set(id, meta);
    return meta;
  }
}

// ---------------------------------------------------------------------------
// Global server-side adapter — set once at startup by createServer()
// ---------------------------------------------------------------------------

let _serverAdapter: JsxFrameworkAdapter | null = null;

/**
 * Register a framework adapter to be used by all island() wrappers on the
 * server. Called by createServer() before any island files are imported.
 */
export function setServerAdapter(adapter: JsxFrameworkAdapter | null): void {
  _serverAdapter = adapter;
}

// ---------------------------------------------------------------------------
// island() wrapper — marks a component for client-side hydration
// ---------------------------------------------------------------------------

export interface IslandOptions<P> {
  /** Export name, usually "default" */
  exportName?: string;
  /**
   * Custom server-side snapshot renderer. When provided, called instead of
   * the built-in renderToString. Injected automatically by the plugin for
   * React/Preact islands; set manually for other frameworks.
   */
  render?: (props: P) => string;
}

/**
 * Wrap a component to mark it as a client-side island.
 *
 * The returned component renders a server-side HTML snapshot inside
 * `<island-placeholder>` with serialized props, and registers the island
 * for client-side hydration.
 *
 * Usage:
 *   export default island(Counter, import.meta.path);
 *
 * The auto-island plugin generates this call automatically — you rarely need
 * to write it by hand.
 */
export function island<P>(
  component: ComponentType<P>,
  filePath: string,
  exportNameOrOptions?: string | IslandOptions<P>,
): ComponentType<P> {
  const exportName =
    typeof exportNameOrOptions === "string"
      ? exportNameOrOptions
      : (exportNameOrOptions?.exportName ?? "default");

  const renderOpt =
    typeof exportNameOrOptions === "object" ? exportNameOrOptions?.render : undefined;

  const id = stableId(filePath, exportName);

  const IslandWrapper = (props: P) => {
    const registry = getIslandRegistry();
    const meta = registry?.register(id);

    // Build the server-side HTML snapshot.
    // Priority: inline render option (injected by plugin for React/Preact)
    //           > global _serverAdapter (set by createServer for custom frameworks)
    //           > built-in renderToString (our mini JSX runtime)
    let snapshot = "";
    if (typeof renderOpt === "function") {
      snapshot = renderOpt(props);
    } else if (_serverAdapter !== null) {
      try {
        snapshot = _serverAdapter.serverRender(component, props as Record<string, unknown>);
      } catch {
        snapshot = "";
      }
    } else {
      try {
        snapshot = builtinRenderToString(component(props));
      } catch {
        snapshot = "";
      }
    }

    // Serialize props (strip non-serializable values like functions)
    const serializedProps = JSON.stringify(props, (_key, val) => {
      if (typeof val === "function") return undefined;
      return val;
    });

    const bundleUrl = meta?.bundleUrl ?? `/_islands/${id}.js`;

    return {
      type: "island-placeholder",
      props: {
        "data-id": id,
        "data-props": serializedProps,
        "data-bundle": bundleUrl,
        dangerouslySetInnerHTML: { __html: snapshot },
      },
    } as unknown as ReturnType<ComponentType<P>>;
  };

  // Attach the island id so the bundler can reference it
  (IslandWrapper as unknown as Record<string, unknown>).__islandId = id;
  (IslandWrapper as unknown as Record<string, unknown>).__islandFilePath = filePath;
  (IslandWrapper as unknown as Record<string, unknown>).__islandExportName = exportName;

  return IslandWrapper as ComponentType<P>;
}

export function stableId(filePath: string, exportName: string): string {
  const hash = createHash("sha1")
    .update(filePath + "::" + exportName)
    .digest("hex")
    .slice(0, 8);
  const base = filePath.split("/").at(-1)?.replace(/\.(island\.)?(tsx?|jsx?)$/, "") ?? "island";
  return `${base}-${hash}`;
}

// ---------------------------------------------------------------------------
// Scan for .island.tsx files (used by bundler at startup)
// ---------------------------------------------------------------------------

/**
 * Find all `.island.{tsx,ts,jsx,js}` files under rootDir.
 * Returns absolute paths. Used by the bundler at startup.
 */
export async function scanIslandFiles(rootDir: string): Promise<string[]> {
  const glob = new Bun.Glob("**/*.island.{tsx,ts,jsx,js}");
  const files: string[] = [];
  for await (const file of glob.scan({ cwd: rootDir, onlyFiles: true })) {
    files.push(`${rootDir}/${file}`);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Re-export useState for use inside island components (client-side only)
// This is a placeholder that throws on the server to signal misuse.
// The actual implementation is in client-runtime.ts (bundled for browser).
// ---------------------------------------------------------------------------

/**
 * State hook for island components.
 *
 * On the server, returns `[initialValue, noop]` so the static snapshot always
 * reflects the initial state. In the browser (after hydration), the client
 * runtime replaces this with a real reactive implementation.
 *
 * Only works inside components wrapped with `island()`. Do not call it in
 * server-only components.
 */
export function useState<T>(initial: T): [T, (val: T) => void] {
  // On the server, island components are rendered without interactivity.
  // If someone calls useState during SSR it just returns the initial value.
  return [initial, () => {}];
}
