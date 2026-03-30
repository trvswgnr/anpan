import { useState } from "preact/hooks";
import { island } from "../../../src/islands/index.ts";

interface CounterProps {
  initial?: number;
}

/**
 * A Preact island component using Preact's own `useState` hook.
 *
 * On the server: rendered to HTML via Preact's `renderToString` (injected by
 * the island plugin when Preact is detected).
 * On the client: mounted with Preact's `render` for full Preact hydration.
 */
function Counter({ initial = 0 }: CounterProps) {
  const [count, setCount] = useState(initial);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "1rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <button onClick={() => setCount(count - 1)} style={{ fontSize: "1.5rem", padding: "0.25rem 0.75rem" }}>-</button>
      <span style={{ fontSize: "1.5rem", minWidth: "2rem", textAlign: "center" }}>{count}</span>
      <button onClick={() => setCount(count + 1)} style={{ fontSize: "1.5rem", padding: "0.25rem 0.75rem" }}>+</button>
    </div>
  );
}

export default island(Counter, import.meta.path);
