import { createDevServer } from "@travvy/anpan";
import type { Middleware } from "@travvy/anpan";

const logger: Middleware = async (req, next) => {
  const start = Date.now();
  const res = await next(req);
  console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} - ${Date.now() - start}ms`);
  return res;
};

const server = await createDevServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  middleware: [logger],
  port: parseInt(process.env.PORT ?? "3000"),
});

console.log(`Running at ${server.url}`);
