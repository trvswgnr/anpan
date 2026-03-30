const USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

export async function GET(_req: Request, _ctx: { params: Record<string, string> }) {
  return Response.json(USERS);
}

export async function POST(req: Request, _ctx: { params: Record<string, string> }) {
  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  const user = { id: USERS.length + 1, name: body.name };
  USERS.push(user);
  return Response.json(user, { status: 201 });
}
