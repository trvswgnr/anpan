import type { BunPlugin } from "bun";

// ---------------------------------------------------------------------------
// Auto-island Bun plugin
//
// Transforms any .island.{tsx,ts,jsx,js} file that does NOT already call
// island() so that its default export is automatically wrapped.
//
// Users can write plain components without any boilerplate:
//
//   // Counter.island.tsx
//   import { useState } from "bun-web-framework/islands";
//
//   export default function Counter({ initial = 0 }) {
//     const [count, setCount] = useState(initial);
//     return <button onclick={() => setCount(count + 1)}>Count: {count}</button>;
//   }
//
// The plugin rewrites this at load time to:
//
//   function Counter({ initial = 0 }) { ... }
//   import { island as __i__ } from "bun-web-framework/islands";
//   export default __i__(Counter, "/abs/path/to/Counter.island.tsx");
//
// Works for both server-side (Bun.plugin()) and browser-side (Bun.build() plugins).
// ---------------------------------------------------------------------------

export function createIslandPlugin(): BunPlugin {
  return {
    name: "bun-web-framework:auto-island",
    setup(build) {
      build.onLoad({ filter: /\.island\.(tsx?|jsx?)$/ }, async (args) => {
        const source = await Bun.file(args.path).text();
        const loader = detectLoader(args.path);

        // If already manually wrapped, skip transformation.
        if (/\bisland\s*\(/.test(source)) {
          return { contents: source, loader };
        }

        const transformed = autoWrap(source, args.path);
        return { contents: transformed, loader };
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
