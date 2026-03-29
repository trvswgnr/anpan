import type { PageProps } from "../../../src/index.ts";
import Counter from "../components/Counter.island.tsx";

export default function HomePage(_props: PageProps) {
  return (
    <>
      <h1>SolidJS Islands Example</h1>
      <p>
        This page uses <strong>SolidJS</strong> for island components via a
        custom <code>jsxFramework</code> adapter in <code>main.ts</code>. Unlike
        React and Preact, SolidJS is not auto-detected — the adapter must be
        provided explicitly.
      </p>
      <p>
        The counter below is an interactive island — SolidJS's{" "}
        <code>createSignal</code> provides fine-grained reactivity on the
        client without a virtual DOM:
      </p>
      <Counter initial={0} />
    </>
  );
}
