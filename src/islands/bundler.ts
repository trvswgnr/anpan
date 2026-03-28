import { join } from "node:path";
import { stableId, scanIslandFiles } from "./index.ts";
import type { IslandManifest, IslandMeta } from "./types.ts";

export const ISLANDS_OUT_DIR = ".bun/islands";
export const ISLANDS_SERVE_PATH = "/_islands";
export const RUNTIME_BUNDLE = "__runtime.js";

// ---------------------------------------------------------------------------
// Build all island files using Bun.build()
// ---------------------------------------------------------------------------

export async function bundleIslands(
  rootDir: string,
  outDir = join(rootDir, ISLANDS_OUT_DIR),
): Promise<IslandManifest> {
  const files = await scanIslandFiles(rootDir);

  if (files.length === 0) {
    // No islands — still emit the client runtime
    await bundleClientRuntime(outDir);
    return new Map();
  }

  const manifest: IslandManifest = new Map();

  // Build the client runtime first with a fixed, predictable name.
  await bundleClientRuntime(outDir);

  // Build all islands in one pass (Bun handles code splitting automatically)
  const result = await Bun.build({
    entrypoints: files,
    outdir: outDir,
    target: "browser",
    splitting: true,
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

  // Map each source island file to its output bundle
  for (const output of result.outputs) {
    if (output.kind !== "entry-point") continue;

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

  return manifest;
}

async function bundleClientRuntime(outDir: string): Promise<void> {
  await Bun.build({
    entrypoints: [join(import.meta.dir, "client-runtime.ts")],
    outdir: outDir,
    target: "browser",
    splitting: false,
    naming: { entry: RUNTIME_BUNDLE },
  });
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
