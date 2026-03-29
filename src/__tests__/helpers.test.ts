import { describe, test, expect } from "bun:test";
import { notFound, redirect, cache, cacheFor } from "../helpers.ts";

describe("notFound", () => {
  test("returns 404 status", () => {
    expect(notFound().status).toBe(404);
  });

  test("accepts a custom body", async () => {
    const res = notFound("custom");
    expect(await res.text()).toBe("custom");
  });
});

describe("redirect", () => {
  test("defaults to 302", () => {
    const res = redirect("/login");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  test("accepts explicit status", () => {
    expect(redirect("/new", 301).status).toBe(301);
    expect(redirect("/new", 307).status).toBe(307);
    expect(redirect("/new", 308).status).toBe(308);
  });
});

describe("cache", () => {
  test("returns the value from the wrapped function", async () => {
    let calls = 0;
    const fn = cache(1000, async (x: number) => {
      calls++;
      return x * 2;
    });
    const result = await fn(5);
    expect(result).toBe(10);
    expect(calls).toBe(1);
  });

  test("returns cached value on second call with same args", async () => {
    let calls = 0;
    const fn = cache(1000, async (x: number) => {
      calls++;
      return x * 2;
    });
    await fn(5);
    await fn(5);
    expect(calls).toBe(1);
  });

  test("calls the function again for different args", async () => {
    let calls = 0;
    const fn = cache(1000, async (x: number) => {
      calls++;
      return x * 2;
    });
    await fn(5);
    await fn(6);
    expect(calls).toBe(2);
  });

  test("re-fetches after TTL expires", async () => {
    let calls = 0;
    const fn = cache(10, async (x: number) => {
      calls++;
      return x;
    });
    await fn(1);
    await Bun.sleep(20); // wait for TTL to expire
    await fn(1);
    expect(calls).toBe(2);
  });

  test("key accounts for all arguments", async () => {
    let calls = 0;
    const fn = cache(1000, async (a: string, b: number) => {
      calls++;
      return `${a}:${b}`;
    });
    await fn("x", 1);
    await fn("x", 2);
    await fn("y", 1);
    expect(calls).toBe(3);
  });
});

describe("cacheFor", () => {
  test("returns a headers object with Cache-Control", () => {
    const result = cacheFor(300);
    expect(result.headers["Cache-Control"]).toContain("max-age=300");
  });

  test("includes stale-while-revalidate", () => {
    const result = cacheFor(300);
    expect(result.headers["Cache-Control"]).toContain("stale-while-revalidate");
  });

  test("spreads cleanly into a loader return", () => {
    const loaderReturn = { data: { ok: true }, ...cacheFor(60) };
    expect(loaderReturn.data).toEqual({ ok: true });
    expect(loaderReturn.headers["Cache-Control"]).toContain("max-age=60");
  });

  test("stale-while-revalidate is a fraction of max-age", () => {
    const { headers } = cacheFor(500);
    const match = headers["Cache-Control"].match(/stale-while-revalidate=(\d+)/);
    const swr = Number(match?.[1]);
    expect(swr).toBeGreaterThan(0);
    expect(swr).toBeLessThan(500);
  });
});
