import type { ApiHandler } from "@travvy/anpan";
import { likes, getPost } from "../../data/posts";

// GET /api/likes?slug=post-id — query param matches flat /api/likes route (no dynamic segment).
export const GET: ApiHandler = (req) => {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }
  return Response.json({ slug, count: likes[slug] ?? 0 });
};

export const POST: ApiHandler = async (req, { params }) => {
  // DX note: params only has what the route pattern defines.
  // This API route is at /api/likes, so params is empty.
  // We read slug from the request body instead.
  let slug: string;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { slug?: string };
    slug = body.slug ?? "";
  } else {
    const form = await req.formData();
    slug = (form.get("slug") as string | null) ?? "";
  }

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!getPost(slug)) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  likes[slug] = (likes[slug] ?? 0) + 1;
  return Response.json({ slug, count: likes[slug] });
};
