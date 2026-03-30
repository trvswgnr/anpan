import { Head } from "anpan";

export default function ErrorPage() {
  return (
    <>
      <Head>
        <title>500 Error</title>
      </Head>
      <h1>500 — Internal Server Error</h1>
      <p>Something went wrong. Please try again later.</p>
    </>
  );
}
