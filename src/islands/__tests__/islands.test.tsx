import { describe, test, expect, beforeAll } from "bun:test";
import { join } from "node:path";
import {
  island,
  stableId,
  scanIslandFiles,
  IslandRegistry,
  runWithIslandRegistry,
  useState,
} from "../index.ts";
import { renderToString } from "../../jsx/runtime.ts";
import type { IslandManifest } from "../types.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(import.meta.dir, "fixtures");
const FAKE_FILE = "/project/src/components/Counter.island.tsx";

function Counter({ initial = 0 }: { initial?: number }) {
  const [count] = useState(initial);
  return { type: "span", props: { children: String(count) } } as unknown as ReturnType<typeof Counter>;
}

// ---------------------------------------------------------------------------
// stableId
// ---------------------------------------------------------------------------

describe("stableId", () => {
  test("produces a stable id with filename prefix and 8-char hash", () => {
    const id = stableId(FAKE_FILE, "default");
    expect(id).toMatch(/^Counter-[a-f0-9]{8}$/);
  });

  test("same inputs → same id (stable across calls)", () => {
    expect(stableId(FAKE_FILE, "default")).toBe(stableId(FAKE_FILE, "default"));
  });

  test("different files → different ids", () => {
    expect(stableId("/a/Foo.island.tsx", "default")).not.toBe(
      stableId("/a/Bar.island.tsx", "default"),
    );
  });

  test("different export names → different ids", () => {
    expect(stableId(FAKE_FILE, "default")).not.toBe(stableId(FAKE_FILE, "named"));
  });

  test("strips .island. suffix from base name", () => {
    const id = stableId("/project/MyWidget.island.tsx", "default");
    expect(id.startsWith("MyWidget-")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// island() wrapper — server-side rendering
// ---------------------------------------------------------------------------

describe("island() wrapper", () => {
  const IslandCounter = island(Counter, FAKE_FILE);

  const fakeManifest: IslandManifest = new Map([
    [
      stableId(FAKE_FILE, "default"),
      {
        id: stableId(FAKE_FILE, "default"),
        filePath: FAKE_FILE,
        exportName: "default",
        bundleUrl: "/_islands/Counter-abc123.js",
      },
    ],
  ]);

  function renderWithRegistry(manifest: IslandManifest, fn: () => unknown) {
    const reg = new IslandRegistry(manifest);
    let result: unknown;
    runWithIslandRegistry(reg, () => { result = fn(); });
    return { result, reg };
  }

  test("returns a component function", () => {
    expect(typeof IslandCounter).toBe("function");
  });

  test("renders an <island-placeholder> element", () => {
    const { result } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 5 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    expect(vnode.type).toBe("island-placeholder");
  });

  test("placeholder has correct data-id", () => {
    const expectedId = stableId(FAKE_FILE, "default");
    const { result } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 0 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    expect(vnode.props["data-id"]).toBe(expectedId);
  });

  test("placeholder serializes props as JSON in data-props", () => {
    const { result } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 42 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    const props = JSON.parse(vnode.props["data-props"] as string);
    expect(props.initial).toBe(42);
  });

  test("placeholder has data-bundle pointing to bundle URL", () => {
    const { result } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 0 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    expect(vnode.props["data-bundle"]).toBe("/_islands/Counter-abc123.js");
  });

  test("placeholder includes server-rendered HTML snapshot", () => {
    const { result } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 7 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    const inner = (vnode.props.dangerouslySetInnerHTML as { __html: string }).__html;
    // The server snapshot should contain the initial value
    expect(inner).toContain("7");
  });

  test("registers the island in the IslandRegistry", () => {
    const { reg } = renderWithRegistry(fakeManifest, () => IslandCounter({ initial: 0 }));
    expect(reg.encountered.size).toBe(1);
    expect(reg.encountered.has(stableId(FAKE_FILE, "default"))).toBe(true);
  });

  test("renders silently when no registry is in scope (no error)", () => {
    // Island rendered outside runWithIslandRegistry — should not throw,
    // just use the fallback bundle URL.
    expect(() => IslandCounter({ initial: 0 })).not.toThrow();
  });

  test("falls back to /_islands/<id>.js when not in manifest", () => {
    const { result } = renderWithRegistry(new Map(), () => IslandCounter({ initial: 0 }));
    const vnode = result as { type: string; props: Record<string, unknown> };
    expect(vnode.props["data-bundle"]).toContain("/_islands/");
  });

  test("strips function props from serialized data-props", () => {
    // Functions can't be serialized to JSON — they must be omitted
    const IslandWithFn = island(
      (props: { label: string; onClick?: () => void }) => ({ type: "button", props: { children: props.label } } as unknown as ReturnType<typeof Counter>),
      "/project/Button.island.tsx",
    );
    const manifest: IslandManifest = new Map();
    const { result } = renderWithRegistry(manifest, () =>
      IslandWithFn({ label: "Click me", onClick: () => {} }),
    );
    const vnode = result as { type: string; props: Record<string, unknown> };
    const parsed = JSON.parse(vnode.props["data-props"] as string);
    expect(parsed.label).toBe("Click me");
    expect("onClick" in parsed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full renderToString with island — checks the HTML output
// ---------------------------------------------------------------------------

describe("renderToString with island", () => {
  const IslandCounter = island(Counter, FAKE_FILE);

  const fakeManifest: IslandManifest = new Map([
    [
      stableId(FAKE_FILE, "default"),
      {
        id: stableId(FAKE_FILE, "default"),
        filePath: FAKE_FILE,
        exportName: "default",
        bundleUrl: "/_islands/counter.js",
      },
    ],
  ]);

  test("renders island-placeholder tag in HTML output", () => {
    const reg = new IslandRegistry(fakeManifest);
    let html = "";
    runWithIslandRegistry(reg, () => {
      html = renderToString({ type: "div", props: { children: IslandCounter({ initial: 3 }) } });
    });
    expect(html).toContain("<island-placeholder");
    expect(html).toContain("data-id=");
    expect(html).toContain("data-props=");
    expect(html).toContain("data-bundle=");
  });

  test("server snapshot is embedded in the placeholder", () => {
    const reg = new IslandRegistry(fakeManifest);
    let html = "";
    runWithIslandRegistry(reg, () => {
      html = renderToString(IslandCounter({ initial: 99 }) as unknown as Parameters<typeof renderToString>[0]);
    });
    // The snapshot should contain the rendered value
    expect(html).toContain("99");
  });

  test("multiple island instances register once per unique island type", () => {
    const reg = new IslandRegistry(fakeManifest);
    runWithIslandRegistry(reg, () => {
      renderToString({
        type: "div",
        props: {
          children: [
            IslandCounter({ initial: 1 }),
            IslandCounter({ initial: 2 }),
            IslandCounter({ initial: 3 }),
          ],
        },
      });
    });
    // All three instances share the same island type — 1 registry entry
    expect(reg.encountered.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// useState — server-side no-op
// ---------------------------------------------------------------------------

describe("useState (server-side)", () => {
  test("returns [initialValue, noop setter]", () => {
    const [val, set] = useState(42);
    expect(val).toBe(42);
    expect(typeof set).toBe("function");
  });

  test("setter is a no-op (does not throw)", () => {
    const [, set] = useState(0);
    expect(() => set(1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// scanIslandFiles
// ---------------------------------------------------------------------------

describe("scanIslandFiles", () => {
  test("finds .island.tsx files", async () => {
    const files = await scanIslandFiles(
      join(import.meta.dir, "../../../example"),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.includes(".island."))).toBe(true);
  });

  test("returns absolute paths", async () => {
    const files = await scanIslandFiles(
      join(import.meta.dir, "../../../example"),
    );
    expect(files.every((f) => f.startsWith("/"))).toBe(true);
  });

  test("returns empty array when no islands exist", async () => {
    // Use a directory with no island files
    const files = await scanIslandFiles(join(import.meta.dir, "../../../src/router"));
    expect(files).toEqual([]);
  });
});
