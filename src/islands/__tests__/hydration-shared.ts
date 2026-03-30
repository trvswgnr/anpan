import type { Page } from "playwright";
import { join } from "node:path";

export const REPO_ROOT = join(import.meta.dir, "../../..");

/**
 * Set SKIP_BROWSER_TESTS=1 to skip Playwright suites without importing playwright.
 * We intentionally do NOT probe Chromium at module load: that used top-level await
 * and sync `playwright install`, which blocked/hung the test file before any hook ran.
 */
export const BROWSER_TESTS_ENABLED = process.env.SKIP_BROWSER_TESTS !== "1";

let ensuredPlaywrightChromium = false;

/** Idempotent; runs at most once per process. Uses pipe stdio so a slow install does not deadlock TTY. */
export function ensurePlaywrightChromium(): void {
  if (ensuredPlaywrightChromium) return;
  ensuredPlaywrightChromium = true;
  const result = Bun.spawnSync({
    cmd: ["bun", "x", "playwright", "install", "chromium"],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const err = new TextDecoder().decode(result.stderr);
    throw new Error(
      `playwright install chromium failed (exit ${result.exitCode}). Run: bunx playwright install chromium\n${err}`,
    );
  }
}

export async function waitForHydration(page: Page, timeout = 8000): Promise<void> {
  await page.waitForFunction(
    () => {
      const placeholders = document.querySelectorAll("island-placeholder");
      return (
        placeholders.length > 0 &&
        Array.from(placeholders).every((el) => el.getAttribute("data-mounted") === "1")
      );
    },
    { timeout },
  );
}
