import { Head } from "@travvy/anpan";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About - Bun Blog</title>
        <meta name="description" content="About this blog and the framework it runs on." />
      </Head>

      <div class="prose">
        <h1>About</h1>
        <p>
          This blog is a demo application for{" "}
          <a href="https://github.com/trvswgnr/anpan">anpan</a>, a
          server-side rendering framework built on top of Bun.
        </p>

        <h2>What makes it different</h2>
        <ul>
          <li>No React. A custom JSX runtime handles server rendering.</li>
          <li>
            Islands architecture. Most of the page is static HTML. Only the components that need
            interactivity are shipped as JavaScript.
          </li>
          <li>Streaming SSR. The browser starts rendering before the full page is ready.</li>
          <li>File-based routing. Drop a file in pages/ and it becomes a route.</li>
        </ul>

        <h2>The stack</h2>
        <ul>
          <li>
            <strong>Runtime:</strong> Bun 1.x
          </li>
          <li>
            <strong>Language:</strong> TypeScript + TSX
          </li>
          <li>
            <strong>Bundler:</strong> Bun.build() (for island components)
          </li>
          <li>
            <strong>Styling:</strong> Plain CSS
          </li>
        </ul>

        <h2>Source</h2>
        <p>
          The full source is at{" "}
          <a href="https://github.com/trvswgnr/anpan">
            github.com/trvswgnr/anpan
          </a>
          .
        </p>
      </div>
    </>
  );
}
