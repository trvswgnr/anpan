import { describe, test, expect } from "bun:test";
import { runMiddleware, type Middleware } from "../index.ts";

const okResponse = () => Promise.resolve(new Response("ok"));
const mockReq = new Request("http://localhost/");

describe("runMiddleware", () => {
  test("calls final handler when chain is empty", async () => {
    const res = await runMiddleware([], mockReq, okResponse);
    expect(await res.text()).toBe("ok");
  });

  test("calls middleware in order", async () => {
    const order: number[] = [];

    const m1: Middleware = async (req, next) => { order.push(1); const r = await next(req); order.push(4); return r; };
    const m2: Middleware = async (req, next) => { order.push(2); const r = await next(req); order.push(3); return r; };

    await runMiddleware([m1, m2], mockReq, okResponse);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  test("middleware can short-circuit", async () => {
    const blocker: Middleware = async (_req, _next) => {
      return new Response("blocked", { status: 403 });
    };

    let finalCalled = false;
    const final = () => { finalCalled = true; return Promise.resolve(new Response("ok")); };

    const res = await runMiddleware([blocker], mockReq, final);
    expect(res.status).toBe(403);
    expect(finalCalled).toBe(false);
  });

  test("middleware can modify request", async () => {
    let receivedReq: Request | null = null;

    const m: Middleware = async (req, next) => {
      const modified = new Request(req, { headers: { "x-custom": "yes" } });
      return next(modified);
    };

    const final = (req: Request) => {
      receivedReq = req;
      return Promise.resolve(new Response("ok"));
    };

    await runMiddleware([m], mockReq, final);
    expect(receivedReq!.headers.get("x-custom")).toBe("yes");
  });

  test("middleware can modify response", async () => {
    const m: Middleware = async (req, next) => {
      const res = await next(req);
      return new Response(res.body, {
        ...res,
        headers: { ...(Object.fromEntries as (i: unknown) => Record<string, string>)(res.headers), "x-timing": "10ms" },
      });
    };

    const res = await runMiddleware([m], mockReq, okResponse);
    expect(res.headers.get("x-timing")).toBe("10ms");
  });
});
