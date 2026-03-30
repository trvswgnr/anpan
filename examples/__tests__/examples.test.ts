/**
 * Integration tests for all example applications.
 *
 * Each example is spawned as a subprocess (mirroring how users run them) on a
 * random free port, exercised via HTTP, then shut down.
 *
 * Prerequisites: `bun install` is run in each example directory if needed
 * (handled automatically in beforeAll).
 */

import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { join } from "node:path";

setDefaultTimeout(60_000);

const EXAMPLES = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ServerHandle {
  base: string;
  proc: ReturnType<typeof Bun.spawn>;
}

/** Install npm/bun dependencies in the given directory (fast no-op if up to date). */
function installDeps(dir: string): void {
  // If node_modules already contains packages, skip the install to avoid
  // potential hangs on local file-path dependencies (e.g. anpan: "../../").
  try {
    const entries = Array.from(
      new Bun.Glob("*").scanSync({ cwd: dir + "/node_modules", onlyFiles: false }),
    );
    if (entries.length > 1) return;
  } catch {
    // node_modules doesn't exist yet — proceed with install
  }

  const result = Bun.spawnSync(["bun", "install"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(`bun install failed in ${dir}:\n${stderr}`);
  }
}

/** Allocate a free TCP port by briefly binding to :0. */
async function getFreePort(): Promise<number> {
  const srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = srv.port;
  await srv.stop(true);
  return port;
}

/**
 * Spawn an example server and wait until it accepts connections.
 * Returns a handle that can be used to make requests and shut down the server.
 */
async function startExample(dir: string, port: number): Promise<ServerHandle> {
  const proc = Bun.spawn(["bun", "run", "main.ts"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  });

  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      await fetch(`${base}/`);
      return { base, proc };
    } catch {
      // server not ready yet
    }
    await Bun.sleep(150);
  }

  // Timed out — collect stderr for a useful error message
  proc.kill();
  const stderrChunks: Uint8Array[] = [];
  const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
  let chunk = await reader.read();
  while (!chunk.done) {
    stderrChunks.push(chunk.value);
    chunk = await reader.read();
  }
  const stderr = new TextDecoder().decode(
    stderrChunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }, new Uint8Array()),
  );
  throw new Error(`Example at ${dir} did not start on port ${port} within 20 s.\nstderr:\n${stderr}`);
}

// ---------------------------------------------------------------------------
// Blog example
// ---------------------------------------------------------------------------

describe("blog example", () => {
  let server: ServerHandle;

  beforeAll(async () => {
    const dir = join(EXAMPLES, "blog");
    installDeps(dir);
    const port = await getFreePort();
    server = await startExample(dir, port);
  });

  afterAll(() => {
    server?.proc.kill();
  });

  test("GET / returns 200 HTML", async () => {
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("GET / contains blog content", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html.toLowerCase()).toContain("blog");
  });

  test("GET /about returns 200", async () => {
    const res = await fetch(`${server.base}/about`);
    expect(res.status).toBe(200);
  });

  test("GET /blog/bun-1-0 returns 200 with post title", async () => {
    const res = await fetch(`${server.base}/blog/bun-1-0`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bun");
  });

  test("GET /blog returns 200", async () => {
    const res = await fetch(`${server.base}/blog`);
    expect(res.status).toBe(200);
  });

  test("POST /api/likes increments like count", async () => {
    const res = await fetch(`${server.base}/api/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "bun-1-0" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { slug: string; count: number };
    expect(data.slug).toBe("bun-1-0");
    expect(typeof data.count).toBe("number");
  });

  test("POST /api/likes with unknown slug returns 404", async () => {
    const res = await fetch(`${server.base}/api/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "no-such-post" }),
    });
    expect(res.status).toBe(404);
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${server.base}/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("island placeholders are rendered server-side", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("island-placeholder");
  });
});

// ---------------------------------------------------------------------------
// React example
// ---------------------------------------------------------------------------

describe("react example", () => {
  let server: ServerHandle;

  beforeAll(async () => {
    const dir = join(EXAMPLES, "react");
    installDeps(dir);
    const port = await getFreePort();
    server = await startExample(dir, port);
  });

  afterAll(() => {
    server?.proc.kill();
  });

  test("GET / returns 200 HTML", async () => {
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("GET / contains React example content", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("React");
  });

  test("GET / renders island placeholder for Counter", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("island-placeholder");
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${server.base}/nonexistent`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Preact example
// ---------------------------------------------------------------------------

describe("preact example", () => {
  let server: ServerHandle;

  beforeAll(async () => {
    const dir = join(EXAMPLES, "preact");
    installDeps(dir);
    const port = await getFreePort();
    server = await startExample(dir, port);
  });

  afterAll(() => {
    server?.proc.kill();
  });

  test("GET / returns 200 HTML", async () => {
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("GET / contains Preact example content", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("Preact");
  });

  test("GET / renders island placeholder for Counter", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("island-placeholder");
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${server.base}/nonexistent`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// SolidJS example
// ---------------------------------------------------------------------------

describe("solidjs example", () => {
  let server: ServerHandle;

  beforeAll(async () => {
    const dir = join(EXAMPLES, "solidjs");
    installDeps(dir);
    const port = await getFreePort();
    server = await startExample(dir, port);
  });

  afterAll(() => {
    server?.proc.kill();
  });

  test("GET / returns 200 HTML", async () => {
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("GET / contains SolidJS example content", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("SolidJS");
  });

  test("GET / renders island placeholder for Counter", async () => {
    const html = await fetch(`${server.base}/`).then((r) => r.text());
    expect(html).toContain("island-placeholder");
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${server.base}/nonexistent`);
    expect(res.status).toBe(404);
  });
});
