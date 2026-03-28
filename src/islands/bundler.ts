import { join } from "node:path";
import { stableId, scanIslandFiles } from "./index.ts";
import type { IslandManifest, IslandMeta } from "./types.ts";
import { createIslandPlugin } from "./plugin.ts";

export const ISLANDS_OUT_DIR = ".bun/islands";
export const ISLANDS_SERVE_PATH = "/_islands";
export const RUNTIME_BUNDLE = "__runtime.js";

// ---------------------------------------------------------------------------
// Bundle result — manifest plus the URL where the runtime was written.
// ---------------------------------------------------------------------------

export interface IslandBundleResult {
  manifest: IslandManifest;
  /** Serve URL for the hydration runtime, e.g. /_islands/__runtime.js */
  runtimeUrl: string;
}

// ---------------------------------------------------------------------------
// Build all island files using Bun.build()
// ---------------------------------------------------------------------------

export async function bundleIslands(
  rootDir: string,
  outDir = join(rootDir, ISLANDS_OUT_DIR),
): Promise<IslandBundleResult> {
  const files = await scanIslandFiles(rootDir);
  const runtimeEntry = join(import.meta.dir, "client-runtime.ts");
  const runtimeUrl = `${ISLANDS_SERVE_PATH}/${RUNTIME_BUNDLE}`;

  if (files.length === 0) {
    // No islands — build the runtime alone with a fixed name.
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
    conditions: ["browser"],
    plugins: [createIslandPlugin()],
    minify: process.env.NODE_ENV === "production",
    naming: {
      entry: "[name]-[hash].js",
      chunk: "[name]-[hash].js",
      asset: "[name]-[hash].[ext]",
    },
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error("[islands bundler]", log.message);
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

  if (runtimeOutputPath) {
    const dest = join(outDir, RUNTIME_BUNDLE);
    await Bun.write(dest, await Bun.file(runtimeOutputPath).text());
  }

  // Map each source island file to its output bundle
  for (const output of result.outputs) {
    if (output.kind !== "entry-point") continue;
    if (output.path.includes("client-runtime")) continue;

    // Find which source file this output corresponds to
    const sourcePath = files.find((f) => {
      const base = f.split("/").at(-1)?.replace(/\.(tsx?|jsx?)$/, "") ?? "";
      return output.path.includes(base);
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

// ---------------------------------------------------------------------------
// Serve a file from the islands output directory
// ---------------------------------------------------------------------------

export async function serveIsland(
  outDir: string,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith(ISLANDS_SERVE_PATH + "/")) return null;
  const fileName = pathname.slice(ISLANDS_SERVE_PATH.length + 1);
  const filePath = join(outDir, fileName);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
