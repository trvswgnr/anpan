/**
 * Counter-island Playwright tests (dev / react / preact / solidjs examples).
 * Split from hydration.browser.test.ts so the blog suite tears down independently
 * (avoids Bun runner "(unnamed)" hook timeouts when the full test matrix runs).
 */

import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { join } from "node:path";
import {
  BROWSER_TESTS_ENABLED,
  ensurePlaywrightChromium,
  waitForHydration,
  REPO_ROOT,
} from "./hydration-shared.ts";

setDefaultTimeout(45_000);

type ExampleHandle = { base: string; proc: ReturnType<typeof Bun.spawn> };

async function startCounterExample(dir: string): Promise<ExampleHandle> {
  const srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = srv.port;
  srv.stop(true);

  const proc = Bun.spawn(["bun", "run", "main.ts"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exampleBase = `http://localhost:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await fetch(exampleBase + "/");
      return { base: exampleBase, proc };
    } catch {
      /* not ready */
    }
    await Bun.sleep(200);
  }
  proc.kill();
  throw new Error(`${dir} did not start within 30 s`);
}

async function clickCounterTimes(
  page: Page,
  plusBtn: string,
  countEl: string,
  n: number,
  expected: number,
): Promise<void> {
  for (let i = 0; i < n; i++) await page.locator(plusBtn).click();
  await page.waitForFunction(
    ([sel, val]: [string, string]) => document.querySelector(sel)?.textContent === val,
    [countEl, String(expected)] as [string, string],
    { timeout: 5000 },
  );
  expect(await page.locator(countEl).textContent()).toBe(String(expected));
}

let browser: Browser;

function counterPage(): Promise<Page> {
  return browser.newPage();
}

describe.skipIf(!BROWSER_TESTS_ENABLED)("Playwright hydration (counter examples)", () => {
  beforeAll(async () => {
    ensurePlaywrightChromium();
    browser = await chromium.launch({ headless: true });
  }, 30_000);

  afterAll(async () => {
    try {
      await Promise.all(browser.contexts().map((ctx) => ctx.close()));
    } catch {
      /* ignore */
    }
    await browser?.close();
  }, 60_000);

  describe("Counter island interactivity", () => {
    describe("dev example", () => {
      let example: ExampleHandle;

      beforeAll(async () => {
        example = await startCounterExample(join(REPO_ROOT, "examples/dev"));
      }, 45_000);

      afterAll(() => {
        try {
          example?.proc.kill();
        } catch {
          /* ignore */
        }
      }, 15_000);

      test("counter increments on + click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/counter`);
        await waitForHydration(p);
        await clickCounterTimes(p, "button:has-text('+')", "span", 3, 3);
        await p.close();
      });

      test("counter decrements on - click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/counter`);
        await waitForHydration(p);
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('-')").click();
        await p.waitForFunction(() => document.querySelector("span")?.textContent === "1", {
          timeout: 5000,
        });
        expect(await p.locator("span").textContent()).toBe("1");
        await p.close();
      });
    });

    describe("react example", () => {
      let example: ExampleHandle;

      beforeAll(async () => {
        example = await startCounterExample(join(REPO_ROOT, "examples/react"));
      }, 45_000);

      afterAll(() => {
        try {
          example?.proc.kill();
        } catch {
          /* ignore */
        }
      }, 15_000);

      test("counter increments on + click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await clickCounterTimes(p, "button:has-text('+')", "span", 3, 3);
        await p.close();
      });

      test("counter decrements on - click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('-')").click();
        await p.waitForFunction(() => document.querySelector("span")?.textContent === "1", {
          timeout: 5000,
        });
        expect(await p.locator("span").textContent()).toBe("1");
        await p.close();
      });
    });

    describe("preact example", () => {
      let example: ExampleHandle;

      beforeAll(async () => {
        example = await startCounterExample(join(REPO_ROOT, "examples/preact"));
      }, 45_000);

      afterAll(() => {
        try {
          example?.proc.kill();
        } catch {
          /* ignore */
        }
      }, 15_000);

      test("counter increments on + click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await clickCounterTimes(p, "button:has-text('+')", "span", 3, 3);
        await p.close();
      });

      test("counter decrements on - click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('-')").click();
        await p.waitForFunction(() => document.querySelector("span")?.textContent === "1", {
          timeout: 5000,
        });
        expect(await p.locator("span").textContent()).toBe("1");
        await p.close();
      });
    });

    describe("solidjs example", () => {
      let example: ExampleHandle;

      beforeAll(async () => {
        example = await startCounterExample(join(REPO_ROOT, "examples/solidjs"));
      }, 45_000);

      afterAll(() => {
        try {
          example?.proc.kill();
        } catch {
          /* ignore */
        }
      }, 15_000);

      test("counter increments on + click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await clickCounterTimes(p, "button:has-text('+')", "span", 3, 3);
        await p.close();
      });

      test("counter decrements on - click", async () => {
        const p = await counterPage();
        await p.goto(`${example.base}/`);
        await waitForHydration(p);
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('+')").click();
        await p.locator("button:has-text('-')").click();
        await p.waitForFunction(() => document.querySelector("span")?.textContent === "1", {
          timeout: 5000,
        });
        expect(await p.locator("span").textContent()).toBe("1");
        await p.close();
      });
    });
  });
});
