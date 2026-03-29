import { createDevServer } from "../../src/index.ts";
import type { Middleware } from "../../src/index.ts";

const logger: Middleware = async (req, next) => {
  const start = Date.now();
  const res = await next(req);
  console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} — ${Date.now() - start}ms`);
  return res;
};

const server = await createDevServer({
  pagesDir: "./examples/dev/pages",
  publicDir: "./examples/dev/public",
  middleware: [logger],
  port: parseInt(process.env.PORT ?? "3000"),
});

console.log(`Running at ${server.url}`);
