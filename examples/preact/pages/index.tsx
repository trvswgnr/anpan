import type { PageProps } from "@travvy/anpan";
import Counter from "../components/Counter.island.tsx";

export default function HomePage(_props: PageProps) {
  return (
    <>
      <h1>Preact Islands Example</h1>
      <p>
        This page uses <strong>Preact</strong> for island components. The
        framework auto-detects Preact from <code>tsconfig.json</code>'s{" "}
        <code>jsxImportSource: "preact"</code> and uses Preact's{" "}
        <code>renderToString</code> for server-side rendering of islands and{" "}
        <code>render</code> for client-side hydration.
      </p>
      <p>
        The counter below is an interactive island - Preact's own{" "}
        <code>useState</code> hook keeps state on the client:
      </p>
      <Counter initial={0} />
    </>
  );
}
