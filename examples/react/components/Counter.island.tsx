import { useState } from "react";
import { island } from "@travvy/anpan/islands";

interface CounterProps {
  initial?: number;
}

/**
 * A React island component using React's own `useState` hook.
 *
 * On the server: rendered to HTML via React's `renderToString` (injected by
 * the island plugin when React is detected).
 * On the client: mounted with `ReactDOM.createRoot` for full React hydration.
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
