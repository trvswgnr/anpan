import { island, useState } from "bun-web-framework/islands";

interface Props {
  slug: string;
  initialCount: number;
}

function LikeButton({ slug, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (liked || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { count: number };
      setCount(data.count);
      setLiked(true);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      class={`like-btn${liked ? " like-btn-liked" : ""}${loading ? " like-btn-loading" : ""}`}
      onclick={handleClick}
      disabled={liked || loading}
      aria-label={liked ? "Already liked" : "Like this post"}
    >
      <span class="like-icon">{liked ? "♥" : "♡"}</span>
      <span class="like-count">{count}</span>
    </button>
  );
}

export default island(LikeButton, import.meta.path);
