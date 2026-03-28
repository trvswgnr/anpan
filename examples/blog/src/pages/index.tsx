import { Head } from "bun-web-framework";
import type { PageProps } from "bun-web-framework";
import { getRecentPosts } from "../data/posts";

export default function HomePage(_props: PageProps) {
  const posts = getRecentPosts(3);

  return (
    <>
      <Head>
        <title>Bun Blog — A framework demo</title>
        <meta name="description" content="A demo blog built with bun-web-framework." />
      </Head>

      <section class="hero">
        <h1>A blog built on Bun</h1>
        <p class="hero-sub">
          Server-side rendering, islands architecture, zero React. Built with{" "}
          <a href="https://bun.sh">Bun</a> and a custom JSX runtime.
        </p>
      </section>

      <section class="post-list">
        <h2>Recent posts</h2>
        {posts.map((post) => (
          <article class="post-card" key={post.slug}>
            <div class="post-card-meta">
              <time datetime={post.date}>{formatDate(post.date)}</time>
              <span class="reading-time">{post.readingTime} min read</span>
            </div>
            <h3>
              <a href={`/blog/${post.slug}`}>{post.title}</a>
            </h3>
            <p class="post-summary">{post.summary}</p>
            <div class="post-tags">
              {post.tags.map((tag) => (
                <a href={`/blog?tag=${tag}`} class="tag" key={tag}>
                  {tag}
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
