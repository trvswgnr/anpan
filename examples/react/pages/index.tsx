import type { PageProps } from "../../../src/index.ts";
import Counter from "../components/Counter.island.tsx";

export default function HomePage(_props: PageProps) {
  return (
    <>
      <h1>React Islands Example</h1>
      <p>
        This page uses <strong>React</strong> for island components. The
        framework auto-detects React from <code>tsconfig.json</code>'s{" "}
        <code>jsxImportSource: "react"</code> and uses React's{" "}
        <code>renderToString</code> for server-side rendering of islands and{" "}
        <code>createRoot</code> for client-side hydration.
      </p>
      <p>
        The counter below is an interactive island — React's own{" "}
        <code>useState</code> hook keeps state on the client:
      </p>
      <Counter initial={0} />
    </>
  );
}
