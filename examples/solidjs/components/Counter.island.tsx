import { useState } from "anpan/islands";
import { island } from "../../../src/islands/index.ts";

interface CounterProps {
  initial?: number;
}

/**
 * An island component demonstrating anpan's built-in useState alongside
 * solid-js. Pages in this example use anpan's JSX runtime; islands use
 * anpan's useState for client-side reactivity and the built-in reconciler
 * for hydration (no framework-specific mount needed).
 *
 * solid-js is available as a peer dependency and can be used for its
 * non-JSX reactive primitives (createStore, createContext, etc.) in
 * server-side code or with a dedicated JSX transform.
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
