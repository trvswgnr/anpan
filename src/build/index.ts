import { join } from "node:path";
import {
  ANPAN_DIR,
  bundleIslands,
  resolveJsxFramework,
} from "../islands/bundler.ts";
import type { JsxFrameworkAdapter } from "../islands/bundler.ts";
import type { ServerLogger } from "../server/index.ts";

export interface BuildConfig {
  /** Input pages directory */
  pagesDir?: string;
  /**
   * Root directory scanned for `.island.tsx` files. Defaults to the parent of
   * `pagesDir`, matching `createServer`'s default `srcDir`.
   */
  srcDir?: string;
  /** Output directory for island bundles. Default: ".anpan" (islands written to .anpan/islands/) */
  outDir?: string;
  /**
   * Custom JSX framework adapter for islands.
   * React and Preact are auto-detected from tsconfig - no adapter needed.
   */
  jsxFramework?: JsxFrameworkAdapter;
  /** Defaults to `console`. */
  logger?: ServerLogger;
}

export async function build(config: BuildConfig = {}): Promise<void> {
  const log = config.logger ?? console;
  const pagesDir = resolve(config.pagesDir ?? "./src/pages");
  const islandRoot = config.srcDir ? resolve(config.srcDir) : join(pagesDir, "..");
  const outDir = resolve(config.outDir ?? ANPAN_DIR);
  const islandOutDir = join(outDir, "islands");

  const adapter = await resolveJsxFramework(config.jsxFramework, process.cwd());

  log.log("[build] Bundling islands...");
  const { manifest } = await bundleIslands(islandRoot, islandOutDir, adapter, {
    logError: log.error.bind(log),
  });
  log.log(`[build] Bundled ${manifest.size} island(s) -> ${islandOutDir}`);

  // Write manifest JSON for reference
  const manifestPath = join(outDir, "island-manifest.json");
  await Bun.write(
    manifestPath,
    JSON.stringify(Object.fromEntries(manifest), null, 2),
  );
  log.log(`[build] Manifest written to ${manifestPath}`);
  log.log("[build] Done.");
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
