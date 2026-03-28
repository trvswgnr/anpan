import { Head } from "bun-web-framework";
import type { PageProps } from "bun-web-framework";
import { posts, getPostsByTag } from "../../data/posts";

export default function BlogIndexPage({ url }: PageProps) {
  const tag = url.searchParams.get("tag");
  const list = tag ? getPostsByTag(tag) : posts;

  const title = tag ? `Posts tagged "${tag}" — Bun Blog` : "All posts — Bun Blog";

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <div class="page-header">
        <h1>{tag ? `Posts tagged "${tag}"` : "All posts"}</h1>
        {tag && (
          <a href="/blog" class="clear-filter">
            Clear filter
          </a>
        )}
      </div>

      {list.length === 0 ? (
        <p class="empty-state">No posts found.</p>
      ) : (
        <div class="post-list">
          {list.map((post) => (
            <article class="post-card" key={post.slug}>
              <div class="post-card-meta">
                <time datetime={post.date}>{formatDate(post.date)}</time>
                <span class="reading-time">{post.readingTime} min read</span>
              </div>
              <h2>
                <a href={`/blog/${post.slug}`}>{post.title}</a>
              </h2>
              <p class="post-summary">{post.summary}</p>
              <div class="post-tags">
                {post.tags.map((t) => (
                  <a href={`/blog?tag=${t}`} class={`tag${t === tag ? " tag-active" : ""}`} key={t}>
                    {t}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
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
