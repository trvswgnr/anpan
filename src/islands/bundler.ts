import { join, resolve } from "node:path";
import { isResolvedPathInsideRoot } from "../server/path-utils.ts";
import { stableId, scanIslandFiles } from "./index.ts";
import type { IslandManifest, IslandMeta, JsxFrameworkAdapter } from "./types.ts";
import { createIslandPlugin } from "./plugin.ts";
import { REACT_ADAPTER, PREACT_ADAPTER } from "./builtin-adapters.ts";

export { type JsxFrameworkAdapter } from "./types.ts";
export { REACT_ADAPTER, PREACT_ADAPTER } from "./builtin-adapters.ts";

/** Default root for framework output (island bundles, manifest) under the app cwd. */
export const ANPAN_DIR = ".anpan";
export const ISLANDS_OUT_DIR = join(ANPAN_DIR, "islands");
export const ISLANDS_SERVE_PATH = "/_islands";
export const RUNTIME_BUNDLE = "__runtime.js";

// Bundle result - manifest plus the URL where the runtime was written.

export interface IslandBundleResult {
  manifest: IslandManifest;
  /** Serve URL for the hydration runtime, e.g. /_islands/__runtime.js */
  runtimeUrl: string;
}

export interface BundleIslandsOptions {
  /** Defaults to `console.error`. */
  logError?: (message?: string, ...optionalParams: unknown[]) => void;
}

// Framework detection from tsconfig.json

/** Which built-in framework (if any) is configured via tsconfig jsxImportSource. */
export type BuiltInFramework = "react" | "preact" | null;

/**
 * Read `compilerOptions.jsxImportSource` from the nearest `tsconfig.json`
 * and return the recognised built-in framework name, or `null`.
 */
export async function detectJsxFramework(cwd: string): Promise<BuiltInFramework> {
  try {
    const raw = await Bun.file(join(cwd, "tsconfig.json")).text();
    const tsconfig = JSON.parse(raw) as { compilerOptions?: { jsxImportSource?: string } };
    const src = tsconfig?.compilerOptions?.jsxImportSource ?? "";
    if (src === "react" || src.startsWith("react-")) return "react";
    if (src === "preact" || src.startsWith("preact/")) return "preact";
  } catch {
    // no tsconfig, parse error, or missing field - fall through
  }
  return null;
}

/**
 * Resolve the effective `JsxFrameworkAdapter` for the current project.
 *
 * Resolution order:
 *   1. Explicit `jsxFramework` on `ServerConfig` / `BuildConfig`.
 *   2. Auto-detected React/Preact from `tsconfig.json`.
 *   3. `null` -> built-in mini-reconciler.
 */
export async function resolveJsxFramework(
  explicitAdapter: JsxFrameworkAdapter | undefined | null,
  cwd: string,
): Promise<JsxFrameworkAdapter | null> {
  if (explicitAdapter != null) return explicitAdapter;
  const detected = await detectJsxFramework(cwd);
  if (detected === "react") return REACT_ADAPTER;
  if (detected === "preact") return PREACT_ADAPTER;
  return null;
}

// Build all island files using Bun.build()

export async function bundleIslands(
  rootDir: string,
  outDir = join(rootDir, ISLANDS_OUT_DIR),
  adapter: JsxFrameworkAdapter | null = null,
  options?: BundleIslandsOptions,
): Promise<IslandBundleResult> {
  const logError = options?.logError ?? console.error.bind(console);
  const files = await scanIslandFiles(rootDir);
  const runtimeEntry = join(import.meta.dir, "client-runtime.ts");
  const runtimeUrl = `${ISLANDS_SERVE_PATH}/${RUNTIME_BUNDLE}`;

  if (files.length === 0) {
    // No islands - build the runtime alone with a fixed name.
    await Bun.build({
      entrypoints: [runtimeEntry],
      outdir: outDir,
      target: "browser",
      splitting: false,
      naming: { entry: RUNTIME_BUNDLE },
    });
    return { manifest: new Map(), runtimeUrl };
  }

  const manifest: IslandManifest = new Map();

  // Build all islands together with the runtime in one pass.
  // Bun.build() with splitting: true puts shared code (useState, h, etc.)
  // in shared chunks, ensuring all islands and the runtime share one instance.
  // The "browser" condition in package.json ensures islands import the browser
  // stub (identity island(), reactive useState) rather than the server version.
  const result = await Bun.build({
    entrypoints: [
      ...files,
      runtimeEntry,
    ],
    outdir: outDir,
    target: "browser",
    splitting: true,
    plugins: [createIslandPlugin("browser", { adapter })],
    minify: process.env.NODE_ENV === "production",
    naming: {
      entry: "[name]-[hash].js",
      chunk: "[name]-[hash].js",
      asset: "[name]-[hash].[ext]",
    },
  });

  if (!result.success) {
    for (const log of result.logs) {
      logError("[islands bundler]", log.message);
    }
    throw new Error("Island bundling failed");
  }

  // Find the actual runtime output filename and rename it to __runtime.js
  // so the renderer can inject a stable URL.
  let runtimeOutputPath: string | undefined;
  for (const output of result.outputs) {
    if (output.kind !== "entry-point") continue;
    if (output.path.includes("client-runtime")) {
      runtimeOutputPath = output.path;
      break;
    }
  }

  if (!runtimeOutputPath) {
    throw new Error(
      "Island bundling succeeded but no client-runtime entry output was found; cannot write __runtime.js",
    );
  }

  const dest = join(outDir, RUNTIME_BUNDLE);
  await Bun.write(dest, await Bun.file(runtimeOutputPath).text());

  // Map each source island file to its output bundle.
  // We match using the path relative to rootDir (which Bun preserves in the
  // output), not just the basename. This handles files with the same name in
  // different directories (e.g. components/Counter.island.tsx vs
  // pages/Counter.island.tsx).
  for (const output of result.outputs) {
    if (output.kind !== "entry-point") continue;
    if (output.path.includes("client-runtime")) continue;

    const sourcePath = files.find((f) => {
      // Check that the output basename STARTS WITH the source basename followed
      // by "-" (before Bun's content hash). This prevents "Button.island" from
      // matching "MyButton.island-{hash}.js" via substring collision.
      const srcBase = f.split("/").at(-1)?.replace(/\.(tsx?|jsx?)$/, "") ?? "";
      const outBasename = output.path.split("/").at(-1) ?? "";
      return outBasename.startsWith(srcBase + "-") || outBasename === srcBase + ".js";
    });

    if (!sourcePath) continue;

    const id = stableId(sourcePath, "default");
    const bundleFileName = output.path.split("/").at(-1)!;
    const bundleUrl = `${ISLANDS_SERVE_PATH}/${bundleFileName}`;

    const meta: IslandMeta = {
      id,
      filePath: sourcePath,
      exportName: "default",
      bundleUrl,
    };
    manifest.set(id, meta);
  }

  return { manifest, runtimeUrl };
}

// Serve a file from the islands output directory

export async function serveIsland(
  outDir: string,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith(ISLANDS_SERVE_PATH + "/")) return null;
  const fileName = pathname.slice(ISLANDS_SERVE_PATH.length + 1);
  const root = resolve(outDir);
  const filePath = resolve(join(root, fileName));
  if (!isResolvedPathInsideRoot(root, filePath) || filePath === root) return null;
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
