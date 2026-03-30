import type { BunPlugin } from "bun";
import { join } from "node:path";
import type { JsxFrameworkAdapter } from "./types.ts";
import { getBuiltinFramework } from "./builtin-adapters.ts";

// ---------------------------------------------------------------------------
// Auto-island Bun plugin
//
// Server mode (registered via Bun.plugin() in createServer):
//   Wraps the default export with island() so it renders as a placeholder
//   and registers itself in the IslandRegistry during SSR.
//
//   Users write plain components:
//     export default function Counter({ initial = 0 }) { ... }
//
//   The plugin rewrites this to:
//     function Counter({ initial = 0 }) { ... }
//     import { island as __i__ } from "anpan/islands";
//     export default __i__(Counter, "/abs/path/to/Counter.island.tsx");
//
//   For React/Preact (built-in adapters), the render option is also injected:
//     import { createElement as __ce__ } from "react";
//     import { renderToString as __rts__ } from "react-dom/server";
//     export default __i__(Counter, path, { render: (p) => __rts__(__ce__(Counter, p)) });
//
//   For user-supplied adapters (Solid, etc.), island() falls back to the
//   global _serverAdapter set via setServerAdapter() at startup.
//
// Browser mode (passed to Bun.build() plugins):
//   Rewrites "anpan/islands" imports to point directly at
//   client-runtime.ts so that:
//     a) useState is the reactive browser version (not the server noop)
//     b) the node:crypto / node:async_hooks server code is never bundled
//   The default export is left as the raw component — island() is identity
//   in the browser so wrapping is unnecessary.
//
//   For React/Preact/custom adapters, a __islandMount named export is appended
//   so the client runtime can use the framework's own render/hydrate API.
// ---------------------------------------------------------------------------

export interface IslandPluginOptions {
  adapter?: JsxFrameworkAdapter | null;
}

const CLIENT_RUNTIME = join(import.meta.dir, "client-runtime.ts");
const JSX_RUNTIME = join(import.meta.dir, "../jsx/jsx-runtime.ts");
const JSX_DEV_RUNTIME = join(import.meta.dir, "../jsx/jsx-dev-runtime.ts");
const ISLANDS_IMPORT_RE = /from\s+["']anpan\/islands["']/g;

export function createIslandPlugin(
  mode: "server" | "browser" = "server",
  options: IslandPluginOptions = {},
): BunPlugin {
  const adapter = options.adapter ?? null;
  return {
    name: "anpan:auto-island",
    setup(build) {
      if (mode === "browser") {
        // Resolve anpan JSX runtimes to their actual file paths so Bun.build()
        // can find them even when `anpan` is not installed in node_modules
        // (e.g. when examples use tsconfig paths instead of a real dep).
        build.onResolve({ filter: /^anpan\/jsx-runtime$/ }, () => ({
          path: JSX_RUNTIME,
        }));
        build.onResolve({ filter: /^anpan\/jsx-dev-runtime$/ }, () => ({
          path: JSX_DEV_RUNTIME,
        }));
      }

      build.onLoad({ filter: /\.island\.(tsx?|jsx?)$/ }, async (args) => {
        const source = await Bun.file(args.path).text();
        const loader = detectLoader(args.path);

        if (mode === "browser") {
          // Rewrite framework island imports to client-runtime so useState is
          // the real reactive version and no server-only code is bundled.
          // Also strip any island() wrapper exports since the component is
          // used directly by the hydration runtime.
          let transformed = source.replace(ISLANDS_IMPORT_RE, `from "${CLIENT_RUNTIME}"`);
          // Remove manually-written island() default exports (backward compat)
          transformed = transformed.replace(
            /\nexport\s+default\s+island\s*\([^)]+\)\s*;?\s*$/m,
            "",
          );

          // If an adapter is configured, append the __islandMount export so
          // the client runtime can use the framework's own render/hydrate API.
          if (adapter !== null) {
            const { name, transformed: namedTransformed } = extractAndNormalizeDefaultExport(transformed);
            if (name !== null) {
              const snippet = adapter.clientMountSnippet.replaceAll("__COMP__", name);
              return { contents: namedTransformed + "\n" + snippet, loader };
            }
          }

          return { contents: transformed, loader };
        }

        // Server mode: auto-wrap if not already wrapped.
        if (/\bisland\s*\(/.test(source)) {
          return { contents: source, loader };
        }

        const wrapped = autoWrap(source, args.path);

        // For built-in React/Preact adapters, inject the framework's
        // renderToString inline so the server snapshot is correct.
        const builtin = adapter !== null ? getBuiltinFramework(adapter) : null;
        if (builtin !== null) {
          return {
            contents: injectServerRender(wrapped, args.path, builtin),
            loader,
          };
        }

        // For user-supplied adapters, island() picks up _serverAdapter at
        // runtime (set via setServerAdapter() in createServer). No injection needed.
        return { contents: wrapped, loader };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function detectLoader(path: string): "tsx" | "ts" | "jsx" | "js" {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  return "js";
}

/**
 * Extract the default export component name from source.
 * Also normalises anonymous arrow/expression defaults to a named const.
 *
 * Returns:
 *   { name: string | null, transformed: string }
 * where `name` is the identifier to use in __islandMount and
 * `transformed` is the (possibly rewritten) source.
 */
function extractAndNormalizeDefaultExport(source: string): {
  name: string | null;
  transformed: string;
} {
  // Pattern 1: export default function Name(
  const funcMatch = source.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) {
    return { name: funcMatch[1]!, transformed: source };
  }

  // Pattern 2: export default Identifier; (last occurrence)
  const idMatch = source.match(/\nexport\s+default\s+(\w+)\s*;?\s*$/);
  if (idMatch) {
    return { name: idMatch[1]!, transformed: source };
  }

  // Pattern 3: export default arrow/expression — normalise to named const
  const exprMatch = source.match(
    /export\s+default\s+((?:async\s+)?(?:function\s*\*?\s*\(|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>))/,
  );
  if (exprMatch) {
    const transformed = source.replace(/export\s+default\s+/, "const __islandDefault__ = ");
    return {
      name: "__islandDefault__",
      transformed: transformed + "\nexport default __islandDefault__;",
    };
  }

  return { name: null, transformed: source };
}

function autoWrap(source: string, filePath: string): string {
  const escaped = JSON.stringify(filePath);

  // Pattern 1: export default function Name(...)
  //   → strip `export default`, keep `function Name(...)`
  const funcDeclMatch = source.match(/export\s+default\s+function\s+(\w+)/);
  if (funcDeclMatch) {
    const name = funcDeclMatch[1]!;
    const modified = source.replace(
      /export\s+default\s+(function\s+\w+)/,
      "$1",
    );
    return (
      `import{island as __i__}from"anpan/islands";\n` +
      modified +
      `\nexport default __i__(${name},${escaped});`
    );
  }

  // Pattern 2: export default Identifier (last line or statement)
  //   const Foo = ...; export default Foo;
  const defaultIdMatch = source.match(/\nexport\s+default\s+(\w+)\s*;?\s*$/);
  if (defaultIdMatch) {
    const name = defaultIdMatch[1]!;
    const modified = source.replace(/\nexport\s+default\s+\w+\s*;?\s*$/, "");
    return (
      `import{island as __i__}from"anpan/islands";\n` +
      modified +
      `\nexport default __i__(${name},${escaped});`
    );
  }

  // Pattern 3: export default arrow/expression
  //   export default (props) => ...
  const defaultExprMatch = source.match(
    /export\s+default\s+((?:async\s+)?(?:function\s*\*?\s*\(|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>))/,
  );
  if (defaultExprMatch) {
    const modified = source.replace(/export\s+default\s+/, "const __comp__ = ");
    return (
      `import{island as __i__}from"anpan/islands";\n` +
      modified +
      `\nexport default __i__(__comp__,${escaped});`
    );
  }

  // Fallback: return unmodified (shouldn't happen for well-formed files)
  return source;
}

/**
 * For built-in React/Preact adapters, rewrite the auto-wrapped output to
 * inject an inline `render` option into the island() call, so the server
 * snapshot uses the correct renderToString.
 *
 * Input (from autoWrap):
 *   import{island as __i__}from"anpan/islands";
 *   function Counter(...) { ... }
 *   export default __i__(Counter,"/path/Counter.island.tsx");
 *
 * Output (React):
 *   import{island as __i__}from"anpan/islands";
 *   import{createElement as __ce__}from"react";
 *   import{renderToString as __rts__}from"react-dom/server";
 *   function Counter(...) { ... }
 *   export default __i__(Counter,"/path/Counter.island.tsx",{render:(p)=>__rts__(__ce__(Counter,p))});
 */
function injectServerRender(
  wrapped: string,
  filePath: string,
  framework: "react" | "preact",
): string {
  const escaped = JSON.stringify(filePath);

  // Extract component name from the island() call at the end
  const callRe = new RegExp(
    `export default __i__\\((\\w+),${escaped}\\);?\\s*$`,
  );
  const match = wrapped.match(callRe);
  if (!match) return wrapped; // couldn't find the call — leave unchanged

  const name = match[1]!;

  let imports: string;
  let renderExpr: string;

  if (framework === "react") {
    imports =
      `import{createElement as __ce__}from"react";\n` +
      `import{renderToString as __rts__}from"react-dom/server";\n`;
    renderExpr = `__rts__(__ce__(${name},p))`;
  } else {
    imports =
      `import{h as __ph__}from"preact";\n` +
      `import{renderToString as __rts__}from"preact-render-to-string";\n`;
    renderExpr = `__rts__(__ph__(${name},p))`;
  }

  const newCall = `export default __i__(${name},${escaped},{render:(p)=>${renderExpr}});`;
  const rewritten = wrapped.replace(callRe, newCall);

  // Insert framework imports after the anpan/islands import
  return rewritten.replace(
    /^(import\{island as __i__\}from"anpan\/islands";\n)/,
    `$1${imports}`,
  );
}
