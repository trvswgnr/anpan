import { island } from "@travvy/anpan/islands";

import { createSignal } from "solid-js";

interface CounterProps {
  initial?: number;
}

const Counter = ({ initial = 0 }: CounterProps) => {
  const [count, setCount] = createSignal(initial);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: "8px",
      }}
    >
      <button
        onClick={() => setCount(count() - 1)}
        style={{ fontSize: "1.5rem", padding: "0.25rem 0.75rem" }}
      >
        -
      </button>
      <span style={{ fontSize: "1.5rem", minWidth: "2rem", textAlign: "center" }}>{count()}</span>
      <button
        onClick={() => setCount(count() + 1)}
        style={{ fontSize: "1.5rem", padding: "0.25rem 0.75rem" }}
      >
        +
      </button>
    </div>
  );
};

export default island(Counter, import.meta.path);
