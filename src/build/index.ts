import { join } from "node:path";
import { ANPAN_DIR, bundleIslands, resolveJsxFramework } from "../islands/bundler.ts";
import type { JsxFrameworkAdapter } from "../islands/bundler.ts";

export interface BuildConfig {
  /** Input pages directory */
  pagesDir?: string;
  /** Output directory for island bundles. Default: ".anpan" (islands written to .anpan/islands/) */
  outDir?: string;
  /**
   * Custom JSX framework adapter for islands.
   * React and Preact are auto-detected from tsconfig — no adapter needed.
   */
  jsxFramework?: JsxFrameworkAdapter;
}

export async function build(config: BuildConfig = {}): Promise<void> {
  const pagesDir = resolve(config.pagesDir ?? "./src/pages");
  const outDir = resolve(config.outDir ?? ANPAN_DIR);
  const islandOutDir = join(outDir, "islands");

  const adapter = await resolveJsxFramework(config.jsxFramework, process.cwd());

  console.log("[build] Bundling islands...");
  const { manifest } = await bundleIslands(pagesDir, islandOutDir, adapter);
  console.log(`[build] Bundled ${manifest.size} island(s) → ${islandOutDir}`);

  // Write manifest JSON for reference
  const manifestPath = join(outDir, "island-manifest.json");
  await Bun.write(
    manifestPath,
    JSON.stringify(Object.fromEntries(manifest), null, 2),
  );
  console.log(`[build] Manifest written to ${manifestPath}`);
  console.log("[build] Done.");
}

function resolve(path: string): string {
  if (path.startsWith("/")) return path;
  return join(process.cwd(), path);
}

// Run if called directly: bun run src/build/index.ts
if (import.meta.main) {
  build().catch((err) => {
    console.error("[build] Failed:", err);
    process.exit(1);
  });
}
