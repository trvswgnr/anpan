import { createServer } from "anpan";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: parseInt(process.env.PORT ?? "3001"),
});

console.log(`Blog running at ${server.url}`);
