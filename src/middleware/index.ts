import type { RouteContext } from "../router/types.ts";

export type Handler = (req: Request) => Response | Promise<Response>;

export type Middleware = (
  req: Request,
  next: Handler,
) => Response | Promise<Response>;

/**
 * Compose a middleware chain using the onion model.
 * Each middleware receives the request and a `next` function.
 * The innermost handler is `final`.
 */
export function runMiddleware(
  chain: Middleware[],
  req: Request,
  final: Handler,
): Promise<Response> {
  const dispatch = (i: number): Handler => {
    if (i >= chain.length) return final;
    const middleware = chain[i]!;
    return (r: Request) => middleware(r, dispatch(i + 1));
  };
  return Promise.resolve(dispatch(0)(req));
}
