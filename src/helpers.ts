// Response helpers - return these from a loader to control the HTTP response.

/**
 * Return a 404 response from a loader.
 *
 * @example
 * export const loader = async ({ params }) => {
 *   const post = getPost(params.slug);
 *   if (!post) return notFound();
 *   return { data: { post } };
 * };
 */
export function notFound(body?: BodyInit): Response {
  return new Response(body ?? "Not Found", { status: 404 });
}

/**
 * Return a redirect response from a loader.
 *
 * @example
 * export const loader = async ({ params }) => {
 *   if (!params.slug) return redirect("/blog");
 *   return { data: {} };
 * };
 */
export function redirect(url: string, status: 301 | 302 | 307 | 308 = 302): Response {
  return new Response(null, { status, headers: { Location: url } });
}

// Caching helpers

/**
 * Wrap an async function with an in-memory TTL cache.
 *
 * Arguments are serialized to JSON to form the cache key, so they must be
 * JSON-serializable. Cache entries are evicted lazily on the next call after
 * they expire - no background timers.
 *
 * @param ttlMs   Time-to-live in milliseconds.
 * @param fn      The async function to memoize.
 *
 * @example
 * // Module-level - one cache shared across all requests.
 * const getPost = cache(60_000, async (slug: string) => {
 *   return await db.posts.findOne(slug);
 * });
 *
 * export const loader: Loader = async ({ params }) => {
 *   const post = await getPost(params.slug);
 *   if (!post) return notFound();
 *   return { data: { post } };
 * };
 */
export function cache<TArgs extends unknown[], TReturn>(
  ttlMs: number,
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  const store = new Map<string, { value: TReturn; expiresAt: number }>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = JSON.stringify(args);
    const entry = store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    const value = await fn(...args);
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}

/**
 * Return HTTP `Cache-Control` headers for use in a loader response.
 *
 * Spreads into the loader return value alongside `data`.
 *
 * @param seconds   How long browsers and CDNs should cache the response.
 *
 * @example
 * export const loader: Loader = async ({ params }) => {
 *   const post = getPost(params.slug);
 *   if (!post) return notFound();
 *   // Cache for 5 minutes, serve stale for 1 minute while revalidating.
 *   return { data: { post }, ...cacheFor(300) };
 * };
 */
export function cacheFor(seconds: number): { headers: Record<string, string> } {
  const swr = Math.max(1, Math.floor(seconds / 5));
  return {
    headers: {
      "Cache-Control": `public, max-age=${seconds}, stale-while-revalidate=${swr}`,
    },
  };
}

