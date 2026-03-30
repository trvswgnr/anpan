/**
 * Regression: many full-page navigations with dev mode (SSE to /__dev/reload)
 * must not exhaust the browser connection pool or hang.
 *
 * Run: bun test src/dev/__tests__/dev-reload-navigation.browser.test.ts
 * Skip: SKIP_BROWSER_TESTS=1 bun test
 */

import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { chromium, type Browser } from "playwright";
import { join } from "node:path";
import {
  BROWSER_TESTS_ENABLED,
  ensurePlaywrightChromium,
  REPO_ROOT,
} from "../../islands/__tests__/hydration-shared.ts";

setDefaultTimeout(45_000);

const DEV_PAGES = join(REPO_ROOT, "examples/dev/src/pages");
const DEV_PUBLIC = join(REPO_ROOT, "examples/dev/public");
const DEV_SRC = join(REPO_ROOT, "examples/dev/src");

/** Four nav links from examples/dev/src/pages/_layout.tsx — cycle 3x = 12 navigations */
const NAV_CYCLE: { href: string; heading: string | RegExp }[] = [
  { href: "/about", heading: "About" },
  { href: "/blog/hello-world", heading: /Blog:/ },
  { href: "/counter", heading: "Islands Demo" },
  { href: "/", heading: "Welcome to anpan" },
];

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let base: string;

describe.skipIf(!BROWSER_TESTS_ENABLED)("Playwright dev reload navigation (MPA)", () => {
  beforeAll(async () => {
    ensurePlaywrightChromium();

    const { createServer } = await import("anpan");

    server = await createServer({
      pagesDir: DEV_PAGES,
      publicDir: DEV_PUBLIC,
      srcDir: DEV_SRC,
      port: 0,
      hostname: "localhost",
      dev: true,
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

  test("12+ link navigations complete without hanging (dev SSE)", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${base}/`, { waitUntil: "load" });

      for (let round = 0; round < 3; round++) {
        for (const { href, heading } of NAV_CYCLE) {
          const expectedUrl = new URL(href, `${base}/`).href;
          await page.locator(`nav a[href="${href}"]`).click();
          await page.waitForURL(expectedUrl, { timeout: 8000 });
          expect(page.url()).toBe(expectedUrl);
          const h1 = page.getByRole("heading", { level: 1 });
          await h1.waitFor({ state: "visible", timeout: 8000 });
          const h1Text = await h1.textContent();
          if (heading instanceof RegExp) {
            expect(h1Text).toMatch(heading);
          } else {
            expect(h1Text).toBe(heading);
          }
        }
      }

      expect(NAV_CYCLE.length * 3).toBe(12);
    } finally {
      await page.close();
    }
  });
});
