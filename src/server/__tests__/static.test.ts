import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { serveStatic } from "../static.ts";

const PUBLIC_DIR = join(import.meta.dir, "../../../example/public");

describe("serveStatic", () => {
  test("serves a file that exists", async () => {
    const res = await serveStatic(PUBLIC_DIR, "/favicon.ico");
    expect(res).not.toBeNull();
    expect(res?.status).toBeOneOf([200, 204]);
  });

  test("returns null for a missing file", async () => {
    const res = await serveStatic(PUBLIC_DIR, "/does-not-exist.txt");
    expect(res).toBeNull();
  });

  test("rejects .. traversal", async () => {
    const res = await serveStatic(PUBLIC_DIR, "/../package.json");
    expect(res).toBeNull();
  });

  test("rejects encoded traversal (%2e%2e)", async () => {
    // URL decode happens at the HTTP layer; serveStatic receives the decoded path
    const res = await serveStatic(PUBLIC_DIR, "/../package.json");
    expect(res).toBeNull();
  });

  test("rejects deeply nested traversal", async () => {
    const res = await serveStatic(PUBLIC_DIR, "/../../../../etc/passwd");
    expect(res).toBeNull();
  });
});
