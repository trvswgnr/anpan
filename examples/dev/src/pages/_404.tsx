import { Head } from "anpan";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>404 Not Found</title>
      </Head>
      <h1>404 — Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/">Go home</a>
    </>
  );
}
