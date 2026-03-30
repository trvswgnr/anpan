import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../index.ts";
import { join } from "node:path";

// Use the example app as the integration test fixture (pages live under src/)
const DEV_EXAMPLE = join(import.meta.dir, "../../../examples/dev");
const PAGES_DIR = join(DEV_EXAMPLE, "src/pages");
const PUBLIC_DIR = join(DEV_EXAMPLE, "public");

let server: ReturnType<typeof Bun.serve>;
let base: string;

beforeAll(async () => {
  server = await createServer({
    pagesDir: PAGES_DIR,
    publicDir: PUBLIC_DIR,
    port: 0, // random available port
    hostname: "localhost",
    dev: false,
  });
  base = server.url.toString().replace(/\/$/, "");
});

afterAll(() => {
  server.stop(true);
});

describe("GET /", () => {
  test("returns 200 HTML", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("contains DOCTYPE", async () => {
    const html = await fetch(`${base}/`).then((r) => r.text());
    expect(html.toLowerCase()).toContain("<!doctype html>");
  });

  test("contains page content", async () => {
    const html = await fetch(`${base}/`).then((r) => r.text());
    expect(html).toContain("anpan");
  });
});

describe("GET /about", () => {
  test("returns 200", async () => {
    const res = await fetch(`${base}/about`);
    expect(res.status).toBe(200);
  });

  test("has custom title in head", async () => {
    const html = await fetch(`${base}/about`).then((r) => r.text());
    expect(html).toContain("<title>About");
  });
});

describe("dynamic routes", () => {
  test("GET /blog/hello-world extracts slug", async () => {
    const html = await fetch(`${base}/blog/hello-world`).then((r) => r.text());
    expect(html).toContain("hello-world");
  });

  test("GET /blog/another-post extracts different slug", async () => {
    const html = await fetch(`${base}/blog/another-post`).then((r) => r.text());
    expect(html).toContain("another-post");
  });
});

describe("API routes", () => {
  test("GET /api/users returns JSON array", async () => {
    const res = await fetch(`${base}/api/users`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const data = await res.json() as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/users creates a user", async () => {
    const res = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Charlie" }),
    });
    expect(res.status).toBe(201);
    const user = await res.json() as { name: string };
    expect(user.name).toBe("Charlie");
  });

  test("POST /api/users without name returns 400", async () => {
    const res = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("404 handling", () => {
  test("returns 404 for unknown routes", async () => {
    const res = await fetch(`${base}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  test("404 page contains helpful content", async () => {
    const html = await fetch(`${base}/definitely-missing`).then((r) => r.text());
    expect(html.toLowerCase()).toContain("not found");
  });
});

describe("streaming", () => {
  test("response body is a readable stream", async () => {
    const res = await fetch(`${base}/`);
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(value).toBeInstanceOf(Uint8Array);
    await reader.cancel();
  });
});

describe("static files", () => {
  test("serves files from public dir", async () => {
    const res = await fetch(`${base}/favicon.ico`);
    // File exists - Bun returns 200 for non-empty files, 204 for empty ones
    expect([200, 204]).toContain(res.status);
  });

  test("rejects path traversal via ..", async () => {
    const res = await fetch(`${base}/../package.json`);
    expect(res.status).toBe(404);
  });

  test("rejects encoded path traversal", async () => {
    const res = await fetch(`${base}/%2e%2e/package.json`);
    expect(res.status).toBe(404);
  });

  test("rejects double-encoded path traversal", async () => {
    const res = await fetch(`${base}/%252e%252e/package.json`);
    expect(res.status).toBe(404);
  });
});
