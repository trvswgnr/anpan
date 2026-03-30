import { Head, notFound, cacheFor } from "anpan";
import type { PageProps, Loader } from "anpan";
import type { RouteContext } from "anpan";
import { getPost, likes, type Post } from "../../data/posts";
import LikeButton from "../../components/LikeButton.island";

type Params = { slug: string };
type Data = { post: Post; likeCount: number };

export const loader: Loader<Data, Params> = async ({ params }: RouteContext<Params>) => {
  const post = getPost(params.slug);
  if (!post) return notFound();
  return { data: { post, likeCount: likes[post.slug] ?? 0 }, ...cacheFor(60) };
};

export default function BlogPostPage({ data, params }: PageProps<typeof loader, Params>) {
  const { post, likeCount } = data;

  return (
    <>
      <Head>
        <title>{post.title} - Bun Blog</title>
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
            <LikeButton slug={params.slug} initialCount={likeCount} />
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
