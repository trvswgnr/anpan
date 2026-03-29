import { useState } from "bun-web-framework/islands";

interface Props {
  slug: string;
  initialCount: number;
}

export default function LikeButton({ slug, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    if (liked || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { count: number };
      setCount(data.count);
      setLiked(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      class={`like-btn${liked ? " like-btn-liked" : ""}${loading ? " like-btn-loading" : ""}${error ? " like-btn-error" : ""}`}
      onclick={handleClick}
      disabled={liked || loading}
      aria-label={liked ? "Already liked" : error ? "Failed — try again" : "Like this post"}
      title={error ? "Something went wrong, try again" : undefined}
    >
      <span class="like-icon">{liked ? "♥" : "♡"}</span>
      <span class="like-count">{count}</span>
    </button>
  );
}
