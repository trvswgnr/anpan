/**
 * Browser hydration tests using Playwright.
 *
 * These tests start the blog example server, open pages in a real Chromium
 * browser, and verify that islands actually become interactive.
 *
 * Run with: bun test src/islands/__tests__/hydration.browser.test.ts
 * (beforeAll runs `bunx playwright install chromium` from the repo root; idempotent when already installed)
 *
 * If Chromium cannot start (e.g. restricted sandbox), the suite is skipped so `bun test` still exits 0.
 * To skip explicitly: SKIP_BROWSER_TESTS=1 bun test
 */

import { test, expect, beforeAll, afterAll, describe, setDefaultTimeout } from "bun:test";

setDefaultTimeout(30_000);
import { chromium, type Browser, type Page } from "playwright";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../..");
const BLOG_PAGES = join(REPO_ROOT, "examples/blog/src/pages");
const BLOG_PUBLIC = join(REPO_ROOT, "examples/blog/public");
const BLOG_SRC = join(REPO_ROOT, "examples/blog/src");

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let base: string;

function ensurePlaywrightChromium(): void {
  const result = Bun.spawnSync({
    cmd: ["bun", "x", "playwright", "install", "chromium"],
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `playwright install chromium failed (exit ${result.exitCode}). Run from repo root: bunx playwright install chromium`,
    );
  }
}

/** Skip entire file when Chromium cannot start (e.g. restricted sandbox) or SKIP_BROWSER_TESTS=1 */
const CHROMIUM_OK: boolean =
  process.env.SKIP_BROWSER_TESTS === "1"
    ? false
    : await (async (): Promise<boolean> => {
        try {
          ensurePlaywrightChromium();
          const b = await chromium.launch({ headless: true });
          await b.close();
          return true;
        } catch {
          return false;
        }
      })();

describe.skipIf(!CHROMIUM_OK)("Playwright hydration", () => {
beforeAll(async () => {
  ensurePlaywrightChromium();

  const { createServer } = await import("anpan");

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
  await browser?.close();
  server?.stop(true);
});

async function newPage(): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

/** Wait until all island-placeholder elements on the page have been hydrated. */
async function waitForHydration(page: Page, timeout = 8000): Promise<void> {
  await page.waitForFunction(
    () => {
      const placeholders = document.querySelectorAll("island-placeholder");
      return placeholders.length > 0 &&
        Array.from(placeholders).every((el) => el.getAttribute("data-mounted") === "1");
    },
    { timeout },
  );
}

// ThemeToggle island

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

    // Initial: no dark theme
    expect(await page.locator("html").getAttribute("data-theme")).toBeNull();

    await btn.click();

    // After click: dark theme applied within 3s
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

// LikeButton island

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

    // Before: empty heart
    expect(await page.locator(".like-icon").textContent()).toBe("o");

    await btn.click();

    // Wait for liked state
    await page.locator(".like-btn-liked").waitFor({ state: "attached", timeout: 3000 });

    expect(await btn.isDisabled()).toBe(true);
    expect(await page.locator(".like-icon").textContent()).toBe("*");
    await page.close();
  });
});

// Multiple islands on the same page

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

    // Dark mode still active
    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    await page.close();
  });
});

// SSR correctness

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

// Counter island interactivity - dev / react / preact / solidjs examples

type ExampleHandle = { base: string; proc: ReturnType<typeof Bun.spawn> };

async function startCounterExample(dir: string): Promise<ExampleHandle> {
  const srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = srv.port;
  srv.stop(true); // fire-and-forget; port is reserved until process binds it

  const proc = Bun.spawn(["bun", "run", "main.ts"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exampleBase = `http://localhost:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { await fetch(exampleBase + "/"); return { base: exampleBase, proc }; } catch { /* not ready */ }
    await Bun.sleep(200);
  }
  proc.kill();
  throw new Error(`${dir} did not start within 30 s`);
}

/** Click + N times and verify the displayed count equals expected. */
async function clickCounterTimes(page: Page, plusBtn: string, countEl: string, n: number, expected: number) {
  for (let i = 0; i < n; i++) await page.locator(plusBtn).click();
  await page.waitForFunction(
    ([sel, val]: [string, string]) => document.querySelector(sel)?.textContent === val,
    [countEl, String(expected)] as [string, string],
    { timeout: 5000 },
  );
  expect(await page.locator(countEl).textContent()).toBe(String(expected));
}

// Counter island interactivity - all examples share one Chromium instance

describe("Counter island interactivity", () => {
  let counterBrowser: Browser;

  beforeAll(async () => {
    counterBrowser = await chromium.launch({ headless: true });
  }, 30_000);

  afterAll(async () => {
    await counterBrowser?.close();
  });

  function counterPage() {
    return counterBrowser.newContext().then((ctx) => ctx.newPage());
  }

  function makeCounterSuite(exampleDir: string, indexPath: string) {
    let example: ExampleHandle;

    beforeAll(async () => {
      example = await startCounterExample(join(REPO_ROOT, exampleDir));
    }, 45_000);

    afterAll(() => {
      example?.proc.kill();
    });

    test("counter increments on + click", async () => {
      const p = await counterPage();
      await p.goto(`${example.base}${indexPath}`);
      await waitForHydration(p);
      await clickCounterTimes(p, "button:has-text('+')", "span", 3, 3);
      await p.close();
    });

    test("counter decrements on - click", async () => {
      const p = await counterPage();
      await p.goto(`${example.base}${indexPath}`);
      await waitForHydration(p);
      await p.locator("button:has-text('+')").click();
      await p.locator("button:has-text('+')").click();
      await p.locator("button:has-text('-')").click();
      await p.waitForFunction(
        () => document.querySelector("span")?.textContent === "1",
        { timeout: 5000 },
      );
      expect(await p.locator("span").textContent()).toBe("1");
      await p.close();
    });
  }

  describe("dev example", () => {
    makeCounterSuite("examples/dev", "/counter");
  });

  describe("react example", () => {
    makeCounterSuite("examples/react", "/");
  });

  describe("preact example", () => {
    makeCounterSuite("examples/preact", "/");
  });

  describe("solidjs example", () => {
    makeCounterSuite("examples/solidjs", "/");
  });
});
}); // Playwright hydration
