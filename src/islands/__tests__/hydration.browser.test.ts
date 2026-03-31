/**
 * Browser hydration tests using Playwright (blog example + SSR).
 * Counter example tests live in hydration.browser.counter.test.ts.
 *
 * Run: bun test src/islands/__tests__/hydration.browser.test.ts
 * Skip browser tests: SKIP_BROWSER_TESTS=1 bun test
 */

import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import type { Browser, Page } from "playwright";
import { join } from "node:path";
import {
  BROWSER_TESTS_ENABLED,
  ensurePlaywrightChromium,
  waitForHydration,
  REPO_ROOT,
} from "./hydration-shared.ts";

setDefaultTimeout(45_000);

const BLOG_PAGES = join(REPO_ROOT, "examples/blog/src/pages");
const BLOG_PUBLIC = join(REPO_ROOT, "examples/blog/public");
const BLOG_SRC = join(REPO_ROOT, "examples/blog/src");

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let base: string;

describe.skipIf(!BROWSER_TESTS_ENABLED)("Playwright hydration (blog)", () => {
  beforeAll(async () => {
    ensurePlaywrightChromium();

    const { chromium } = await import("playwright");
    const { createServer } = await import("@travvy/anpan");

    server = await createServer({
      pagesDir: BLOG_PAGES,
      publicDir: BLOG_PUBLIC,
      srcDir: BLOG_SRC,
      port: 0,
      hostname: "localhost",
      dev: false,
    });
    base = server.url.toString().replace(/\/$/, "");
    browser = await chromium.launch({ headless: true });
  }, 30_000);

  afterAll(async () => {
    try {
      await Promise.all(browser.contexts().map((ctx) => ctx.close()));
    } catch {
      /* ignore */
    }
    await browser?.close();
    server?.stop(true);
  }, 60_000);

  function newPage(): Promise<Page> {
    return browser.newPage();
  }

  describe("ThemeToggle island", () => {
    test("renders server snapshot before JS loads", async () => {
      const page = await newPage();
      await page.goto(`${base}/`);
      await page.locator(".theme-toggle").waitFor({ state: "visible", timeout: 5000 });
      await page.close();
    });

    test("hydrates and toggles dark mode on click", async () => {
      const page = await newPage();
      await page.goto(`${base}/`);
      await waitForHydration(page);

      const btn = page.locator(".theme-toggle");

      expect(await page.locator("html").getAttribute("data-theme")).toBeNull();

      await btn.click();

      await page.locator("html[data-theme='dark']").waitFor({ state: "attached", timeout: 3000 });
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      await page.close();
    });

    test("toggles back to light on second click", async () => {
      const page = await newPage();
      await page.goto(`${base}/`);
      await waitForHydration(page);

      const btn = page.locator(".theme-toggle");
      await btn.click();
      await page.locator("html[data-theme='dark']").waitFor({ state: "attached", timeout: 3000 });

      await btn.click();
      await page.waitForFunction(
        () => !document.documentElement.hasAttribute("data-theme"),
        { timeout: 3000 },
      );
      expect(await page.locator("html").getAttribute("data-theme")).toBeNull();
      await page.close();
    });
  });

  describe("LikeButton island", () => {
    test("renders server-side like count before JS loads", async () => {
      const page = await newPage();
      await page.goto(`${base}/blog/bun-1-0`);
      await page.locator(".like-count").waitFor({ state: "visible", timeout: 5000 });
      const text = await page.locator(".like-count").textContent();
      expect(Number(text)).toBeGreaterThanOrEqual(0);
      await page.close();
    });

    test("hydrates: clicking like increments the count", async () => {
      const page = await newPage();
      await page.goto(`${base}/blog/bun-1-0`);
      await waitForHydration(page);

      const btn = page.locator(".like-btn");
      const countBefore = Number(await page.locator(".like-count").textContent());

      await page.route("**/api/likes", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ slug: "bun-1-0", count: countBefore + 1 }),
        });
      });

      await btn.click();

      await page.waitForFunction(
        (expected) => {
          const el = document.querySelector(".like-count");
          return el?.textContent === String(expected);
        },
        countBefore + 1,
        { timeout: 3000 },
      );

      const countAfter = Number(await page.locator(".like-count").textContent());
      expect(countAfter).toBe(countBefore + 1);
      await page.close();
    });

    test("button is disabled and shows filled heart after liking", async () => {
      const page = await newPage();
      await page.goto(`${base}/blog/bun-1-0`);
      await waitForHydration(page);

      const btn = page.locator(".like-btn");
      const countBefore = Number(await page.locator(".like-count").textContent());

      await page.route("**/api/likes", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ slug: "bun-1-0", count: countBefore + 1 }),
        });
      });

      expect(await page.locator(".like-icon").textContent()).toBe("o");

      await btn.click();

      await page.locator(".like-btn-liked").waitFor({ state: "attached", timeout: 3000 });

      expect(await btn.isDisabled()).toBe(true);
      expect(await page.locator(".like-icon").textContent()).toBe("*");
      await page.close();
    });
  });

  describe("multiple islands on the same page", () => {
    test("ThemeToggle and LikeButton hydrate independently", async () => {
      const page = await newPage();
      await page.goto(`${base}/blog/islands-architecture`);

      await waitForHydration(page);

      const toggle = page.locator(".theme-toggle");
      const like = page.locator(".like-btn");

      await toggle.click();
      await page.locator("html[data-theme='dark']").waitFor({ state: "attached", timeout: 3000 });

      const countBefore = Number(await page.locator(".like-count").textContent());
      await page.route("**/api/likes", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ slug: "islands-architecture", count: countBefore + 1 }),
        });
      });

      await like.click();
      await page.waitForFunction(
        (expected) => document.querySelector(".like-count")?.textContent === String(expected),
        countBefore + 1,
        { timeout: 3000 },
      );

      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      await page.close();
    });
  });

  describe("SSR in browser", () => {
    test("page content visible without JavaScript", async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${base}/`);

      const h1 = await page.locator("h1").textContent();
      expect(h1).toContain("A blog built on Bun");

      const cards = await page.locator(".post-card").count();
      expect(cards).toBe(3);

      await page.close();
      await ctx.close();
    });

    test("404 page returns 404 status with custom content", async () => {
      const page = await newPage();
      const res = await page.goto(`${base}/blog/this-slug-does-not-exist`);
      expect(res?.status()).toBe(404);
      const title = await page.title();
      expect(title).toBe("404 Not Found - Bun Blog");
      await page.close();
    });

    test("blog post renders data from loader", async () => {
      const page = await newPage();
      await page.goto(`${base}/blog/bun-1-0`);
      const h1 = await page.locator("h1").textContent();
      expect(h1).toBe("Bun 1.0 is here");
      await page.close();
    });
  });
});
