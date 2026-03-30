# Examples

Sample apps for trying anpan from a **clone of this repo**. They are useful for contributors (tests and integration also reference some of these paths) and for anyone who wants to run the framework against **local source** before publishing.

## Prerequisites

Same as the main project: [Bun](https://bun.sh) >= 1.1.0.

## How these examples resolve `anpan`

Each example's `tsconfig.json` maps the `anpan` package to `../../src/...` (see [examples/dev/tsconfig.json](dev/tsconfig.json)). Entry files such as [`dev/main.ts`](dev/main.ts) import from `"anpan"` or from `../../src/index.ts` so you do **not** need `bun link` or a published package to run them.

## Working directory matters

`createServer` / `createDevServer` options like `pagesDir` and `publicDir` are **relative to the process current working directory**, not to the entry file. Always start the server from **inside** the example directory, or use the repo-root npm scripts listed below (they `cd` into the right folder first).

## From the repository root

After `bun install` at the repo root (for tests and tooling):

| Script | Example |
|--------|---------|
| `bun dev` | [`dev`](dev/) - dev server with hot reload |
| `bun run example:blog` | [`blog`](blog/) |
| `bun run example:react` | [`react`](react/) |
| `bun run example:preact` | [`preact`](preact/) |
| `bun run example:solidjs` | [`solidjs`](solidjs/) |

## From inside an example

```sh
cd examples/<name>
bun install   # only needed for react, preact, and solidjs (extra dependencies)
bun run dev
```

## Ports and `PORT`

Default ports are chosen so you can run several examples at once on one machine:

| Example | Highlights | Default port | Extra `bun install`? |
|---------|------------|--------------|----------------------|
| `dev` | `createDevServer`, middleware, `src/pages` layout, API route | 3000 | No |
| `blog` | `createServer`, richer content | 3001 | No |
| `react` | React islands (`jsxImportSource: "react"`) | 3002 | Yes |
| `preact` | Preact islands | 3003 | Yes |
| `solidjs` | Custom `jsxFramework` adapter (see [`solidjs/main.ts`](solidjs/main.ts)) | 3004 | Yes |

Every example reads `process.env.PORT` when set, so you can override defaults, e.g. `PORT=4000 bun run dev`.

## More documentation

Framework usage (pages, loaders, islands, etc.) is documented in the [project README](../README.md).
