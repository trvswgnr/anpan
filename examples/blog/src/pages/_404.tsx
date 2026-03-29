import { Head } from "anpan";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>404 Not Found — Bun Blog</title>
      </Head>
      <div class="error-page">
        <h1>404</h1>
        <p>That page does not exist.</p>
        <a href="/" class="btn">
          Go home
        </a>
      </div>
    </>
  );
}
