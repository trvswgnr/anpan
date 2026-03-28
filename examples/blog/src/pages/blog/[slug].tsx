import { Head } from "bun-web-framework";
import type { PageProps } from "bun-web-framework";
import { getPost, likes } from "../../data/posts";
import LikeButton from "../../components/LikeButton.island";

export default function BlogPostPage({ params }: PageProps) {
  const post = getPost(params.slug);

  if (!post) {
    // DX pain point: no way to set response status from a page component.
    // A 404 requires the user to navigate away or rely on _404.tsx.
    // Ideally pages could export a `loader` that returns data + status.
    return (
      <>
        <Head>
          <title>Post not found — Bun Blog</title>
        </Head>
        <div class="prose">
          <h1>Post not found</h1>
          <p>
            <a href="/blog">Back to all posts</a>
          </p>
        </div>
      </>
    );
  }

  const likeCount = likes[post.slug] ?? 0;

  return (
    <>
      <Head>
        <title>{post.title} — Bun Blog</title>
        <meta name="description" content={post.summary} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.summary} />
      </Head>

      <article class="post-full">
        <header class="post-full-header">
          <div class="post-card-meta">
            <time datetime={post.date}>{formatDate(post.date)}</time>
            <span class="reading-time">{post.readingTime} min read</span>
          </div>
          <h1>{post.title}</h1>
          <p class="post-summary lead">{post.summary}</p>
          <div class="post-tags">
            {post.tags.map((tag) => (
              <a href={`/blog?tag=${tag}`} class="tag" key={tag}>
                {tag}
              </a>
            ))}
          </div>
        </header>

        <div class="post-body" dangerouslySetInnerHTML={{ __html: post.body }} />

        <footer class="post-full-footer">
          <div class="like-row">
            <LikeButton slug={post.slug} initialCount={likeCount} />
          </div>
          <a href="/blog" class="back-link">
            &larr; All posts
          </a>
        </footer>
      </article>
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
