/**
 * React example for anpan.
 *
 * Because this project's tsconfig.json sets `jsxImportSource: "react"`, the
 * framework auto-detects React and uses it for island server-rendering and
 * client-side hydration. No explicit `jsxFramework` option is needed.
 *
 * Run:
 *   cd examples/react && bun install && bun run dev
 */
import { createServer } from "../../src/index.ts";

const server = await createServer({
  pagesDir: "./pages",
  port: parseInt(process.env.PORT ?? "3002"),
});

console.log(`React example running at ${server.url}`);
