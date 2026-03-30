import { Head } from "anpan";
import type { PageProps } from "anpan";

export default function BlogPost({ params }: PageProps) {
  const { slug } = params;
  return (
    <>
      <Head>
        <title>{slug} - Blog</title>
      </Head>
      <h1>Blog: {slug}</h1>
      <p>This is a dynamically routed page. Slug parameter: <code>{slug}</code></p>
    </>
  );
}
