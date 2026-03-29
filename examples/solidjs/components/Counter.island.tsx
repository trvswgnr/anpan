import { createSignal } from "solid-js";
import { island } from "../../../src/islands/index.ts";

interface CounterProps {
  initial?: number;
}

/**
 * A SolidJS island component using SolidJS's `createSignal` for fine-grained
 * reactivity.
 *
 * On the server: rendered to HTML via SolidJS's `renderToString` (provided by
 * the explicit adapter in main.ts).
 * On the client: mounted with SolidJS's `render`, which sets up reactive DOM
 * updates without a virtual DOM diff cycle.
 *
 * NOTE: Requires the SolidJS JSX transform (e.g. bun-plugin-solid) for correct
 * compilation. Without it, JSX compiles to React.createElement which SolidJS
 * cannot hydrate as reactive primitives.
 */
function Counter({ initial = 0 }: CounterProps) {
  const [count, setCount] = createSignal(initial);
  return (
    <div style={{ display: "inline-flex", "align-items": "center", gap: "1rem", padding: "1rem", border: "1px solid #ccc", "border-radius": "8px" }}>
      <button onClick={() => setCount(count() - 1)} style={{ "font-size": "1.5rem", padding: "0.25rem 0.75rem" }}>−</button>
      <span style={{ "font-size": "1.5rem", "min-width": "2rem", "text-align": "center" }}>{count()}</span>
      <button onClick={() => setCount(count() + 1)} style={{ "font-size": "1.5rem", padding: "0.25rem 0.75rem" }}>+</button>
    </div>
  );
}

export default island(Counter, import.meta.path);
