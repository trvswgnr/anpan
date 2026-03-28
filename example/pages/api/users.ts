import type { RouteContext } from "../../../src/index.ts";

const USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

export async function GET(_req: Request, _ctx: { params: Record<string, string> }) {
  return Response.json(USERS);
}

export async function POST(req: Request, _ctx: { params: Record<string, string> }) {
  const body = await req.json() as { name?: string };
  if (!body.name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  const user = { id: USERS.length + 1, name: body.name };
  USERS.push(user);
  return Response.json(user, { status: 201 });
}
