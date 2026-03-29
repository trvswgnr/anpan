/**
 * Preact example for anpan.
 *
 * Because this project's tsconfig.json sets `jsxImportSource: "preact"`, the
 * framework auto-detects Preact and uses it for island server-rendering and
 * client-side hydration. No explicit `jsxFramework` option is needed.
 *
 * Run:
 *   cd examples/preact && bun install && bun run dev
 */
import { createServer } from "../../src/index.ts";

const server = await createServer({
  pagesDir: "./examples/preact/pages",
  port: 3003,
});

console.log(`Preact example running at ${server.url}`);
