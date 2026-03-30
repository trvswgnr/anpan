/**
 * Blog-style example for anpan using `createServer` (no dev watcher).
 *
 * Run:
 *   cd examples/blog && bun run dev
 * Or from repo root:
 *   bun run example:blog
 */
import { createServer } from "../../src/index.ts";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: parseInt(process.env.PORT ?? "3001"),
});

console.log(`Blog running at ${server.url}`);
