// ---------------------------------------------------------------------------
// Response helpers — return these from a loader to control the HTTP response.
// ---------------------------------------------------------------------------

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
