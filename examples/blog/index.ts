/**
 * Blog-style example for anpan using `createServer` (no dev watcher).
 *
 * Run:
 *   cd examples/blog && bun run dev
 * Or from repo root:
 *   ./scripts/run-example.sh blog
 */
import { createServer } from "@travvy/anpan";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: parseInt(process.env.PORT ?? "3001"),
});

console.log(`Blog running at ${server.url}`);
