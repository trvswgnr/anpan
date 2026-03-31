import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import {
  detectJsxFramework,
  resolveJsxFramework,
  REACT_ADAPTER,
  PREACT_ADAPTER,
} from "../bundler.ts";
import {
  getBuiltinFramework,
  BUILTIN_FRAMEWORK,
} from "../builtin-adapters.ts";
import type { JsxFrameworkAdapter } from "../types.ts";

const FIXTURES = join(import.meta.dir, "fixtures");

// detectJsxFramework

describe("detectJsxFramework", () => {
  test('returns "react" for jsxImportSource: "react"', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "react"))).toBe("react");
  });

  test('returns "react" for jsxImportSource starting with "react-" (e.g. "react-dom")', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "react-compat"))).toBe("react");
  });

  test('returns "preact" for jsxImportSource: "preact"', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "preact"))).toBe("preact");
  });

  test('returns "preact" for jsxImportSource starting with "preact/" (e.g. "preact/compat")', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "preact-compat"))).toBe("preact");
  });

  test('returns null for jsxImportSource: "solid-js" (unknown framework)', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "solidjs"))).toBeNull();
  });

  test('returns null for jsxImportSource: "@travvy/anpan" (built-in)', async () => {
    expect(await detectJsxFramework(join(FIXTURES, "default"))).toBeNull();
  });

  test("returns null when tsconfig.json is malformed JSON", async () => {
    expect(await detectJsxFramework(join(FIXTURES, "malformed"))).toBeNull();
  });

  test("returns null when no tsconfig.json exists in the directory", async () => {
    // fixtures/ root itself has no tsconfig.json
    expect(await detectJsxFramework(FIXTURES)).toBeNull();
  });
});

// resolveJsxFramework

describe("resolveJsxFramework", () => {
  test("returns explicit adapter when provided (ignores tsconfig)", async () => {
    const custom: JsxFrameworkAdapter = {
      serverRender: () => "<div>solid</div>",
      clientMountSnippet: `export const __islandMount=(el,p)=>{}`,
    };
    const result = await resolveJsxFramework(custom, join(FIXTURES, "react"));
    expect(result).toBe(custom);
  });

  test("returns REACT_ADAPTER when React detected from tsconfig", async () => {
    const result = await resolveJsxFramework(undefined, join(FIXTURES, "react"));
    expect(result).toBe(REACT_ADAPTER);
  });

  test("returns PREACT_ADAPTER when Preact detected from tsconfig", async () => {
    const result = await resolveJsxFramework(undefined, join(FIXTURES, "preact"));
    expect(result).toBe(PREACT_ADAPTER);
  });

  test("returns null when no known framework in tsconfig (custom/built-in)", async () => {
    const result = await resolveJsxFramework(undefined, join(FIXTURES, "solidjs"));
    expect(result).toBeNull();
  });

  test("returns null when no tsconfig exists", async () => {
    const result = await resolveJsxFramework(undefined, FIXTURES);
    expect(result).toBeNull();
  });

  test("returns null when explicit adapter is null", async () => {
    const result = await resolveJsxFramework(null, join(FIXTURES, "react"));
    // null is treated as "no explicit adapter" -> falls back to auto-detection
    expect(result).toBe(REACT_ADAPTER);
  });
});

// REACT_ADAPTER content

describe("REACT_ADAPTER", () => {
  test("clientMountSnippet imports createElement from react", () => {
    expect(REACT_ADAPTER.clientMountSnippet).toContain(`from"react"`);
    expect(REACT_ADAPTER.clientMountSnippet).toContain("createElement");
  });

  test("clientMountSnippet imports createRoot from react-dom/client", () => {
    expect(REACT_ADAPTER.clientMountSnippet).toContain(`from"react-dom/client"`);
    expect(REACT_ADAPTER.clientMountSnippet).toContain("createRoot");
  });

  test("clientMountSnippet exports __islandMount", () => {
    expect(REACT_ADAPTER.clientMountSnippet).toContain("__islandMount");
  });

  test("clientMountSnippet uses __COMP__ placeholder", () => {
    expect(REACT_ADAPTER.clientMountSnippet).toContain("__COMP__");
  });

  test("serverRender throws (plugin injects inline)", () => {
    expect(() => REACT_ADAPTER.serverRender({}, {})).toThrow();
  });
});

// PREACT_ADAPTER content

describe("PREACT_ADAPTER", () => {
  test("clientMountSnippet imports h and render from preact", () => {
    expect(PREACT_ADAPTER.clientMountSnippet).toContain(`from"preact"`);
  });

  test("clientMountSnippet uses preact render function", () => {
    expect(PREACT_ADAPTER.clientMountSnippet).toContain("render");
  });

  test("clientMountSnippet exports __islandMount", () => {
    expect(PREACT_ADAPTER.clientMountSnippet).toContain("__islandMount");
  });

  test("clientMountSnippet uses __COMP__ placeholder", () => {
    expect(PREACT_ADAPTER.clientMountSnippet).toContain("__COMP__");
  });

  test("serverRender throws (plugin injects inline)", () => {
    expect(() => PREACT_ADAPTER.serverRender({}, {})).toThrow();
  });
});

// getBuiltinFramework

describe("getBuiltinFramework", () => {
  test('returns "react" for REACT_ADAPTER', () => {
    expect(getBuiltinFramework(REACT_ADAPTER)).toBe("react");
  });

  test('returns "preact" for PREACT_ADAPTER', () => {
    expect(getBuiltinFramework(PREACT_ADAPTER)).toBe("preact");
  });

  test("returns null for a plain custom adapter", () => {
    const custom: JsxFrameworkAdapter = {
      serverRender: () => "",
      clientMountSnippet: "",
    };
    expect(getBuiltinFramework(custom)).toBeNull();
  });
});

// Custom adapter (SolidJS-style) - interface compliance

describe("custom adapter (SolidJS-style)", () => {
  const solidAdapter: JsxFrameworkAdapter = {
    serverRender: (comp, props) => {
      // In a real SolidJS project: renderToString(() => (comp as any)(props))
      return `<div data-framework="solid">${JSON.stringify(props)}</div>`;
    },
    clientMountSnippet:
      `import{render as __sr__}from"solid-js/web";` +
      `export const __islandMount=(el,props)=>__sr__(()=>__COMP__(props),el);`,
  };

  test("satisfies JsxFrameworkAdapter interface", () => {
    expect(typeof solidAdapter.serverRender).toBe("function");
    expect(typeof solidAdapter.clientMountSnippet).toBe("string");
  });

  test("serverRender returns an HTML string", () => {
    const html = solidAdapter.serverRender({}, { count: 0 });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  test("clientMountSnippet exports __islandMount", () => {
    expect(solidAdapter.clientMountSnippet).toContain("__islandMount");
  });

  test("clientMountSnippet imports from solid-js/web", () => {
    expect(solidAdapter.clientMountSnippet).toContain(`from"solid-js/web"`);
  });

  test("is not identified as a built-in by getBuiltinFramework", () => {
    expect(getBuiltinFramework(solidAdapter)).toBeNull();
  });

  test("resolveJsxFramework returns it unchanged", async () => {
    const result = await resolveJsxFramework(solidAdapter, FIXTURES);
    expect(result).toBe(solidAdapter);
  });
});
