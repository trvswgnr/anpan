import { createServer } from "anpan";

const server = await createServer({
  pagesDir: "./src/pages",
  publicDir: "./public",
  port: 3001,
});

console.log(`Blog running at ${server.url}`);
