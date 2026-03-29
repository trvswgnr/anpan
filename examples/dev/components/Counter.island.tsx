import { island, useState } from "../../../src/islands/index.ts";

interface CounterProps {
  initial?: number;
}

function Counter({ initial = 0 }: CounterProps) {
  const [count, setCount] = useState(initial);
  return (
    <div style="display: inline-flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px;">
      <button onclick={() => setCount(count - 1)} style="font-size: 1.5rem; padding: 0.25rem 0.75rem;">−</button>
      <span style="font-size: 1.5rem; min-width: 2rem; text-align: center;">{count}</span>
      <button onclick={() => setCount(count + 1)} style="font-size: 1.5rem; padding: 0.25rem 0.75rem;">+</button>
    </div>
  );
}

export default island(Counter, import.meta.path);
