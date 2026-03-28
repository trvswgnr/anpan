import type { BunPlugin } from "bun";
import { join } from "node:path";

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
//     import { island as __i__ } from "bun-web-framework/islands";
//     export default __i__(Counter, "/abs/path/to/Counter.island.tsx");
//
// Browser mode (passed to Bun.build() plugins):
//   Rewrites "bun-web-framework/islands" imports to point directly at
//   client-runtime.ts so that:
//     a) useState is the reactive browser version (not the server noop)
//     b) the node:crypto / node:async_hooks server code is never bundled
//   The default export is left as the raw component — island() is identity
//   in the browser so wrapping is unnecessary.
// ---------------------------------------------------------------------------

const CLIENT_RUNTIME = join(import.meta.dir, "client-runtime.ts");
const ISLANDS_IMPORT_RE = /from\s+["']bun-web-framework\/islands["']/g;

export function createIslandPlugin(mode: "server" | "browser" = "server"): BunPlugin {
  return {
    name: "bun-web-framework:auto-island",
    setup(build) {
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
          return { contents: transformed, loader };
        }

        // Server mode: auto-wrap if not already wrapped.
        if (/\bisland\s*\(/.test(source)) {
          return { contents: source, loader };
        }

        return { contents: autoWrap(source, args.path), loader };
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
      `import{island as __i__}from"bun-web-framework/islands";\n` +
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
      `import{island as __i__}from"bun-web-framework/islands";\n` +
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
      `import{island as __i__}from"bun-web-framework/islands";\n` +
      modified +
      `\nexport default __i__(__comp__,${escaped});`
    );
  }

  // Fallback: return unmodified (shouldn't happen for well-formed files)
  return source;
}
