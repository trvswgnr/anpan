import { Head } from "anpan";
import type { PageProps } from "../../../../src/index.ts";

export default function HomePage(_props: PageProps) {
  return (
    <>
      <Head>
        <title>Home — anpan</title>
        <meta name="description" content="A Bun-native SSR framework" />
      </Head>
      <h1>Welcome to anpan</h1>
      <p>A lightweight SSR framework built on Bun with:</p>
      <ul>
        <li>File-based routing</li>
        <li>Custom JSX runtime (zero React dependency)</li>
        <li>Islands architecture for client interactivity</li>
        <li>Streaming SSR via ReadableStream</li>
        <li>Head management via {"<Head>"}</li>
        <li>Middleware support</li>
      </ul>
    </>
  );
}
