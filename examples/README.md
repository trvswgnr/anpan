# Examples

Sample apps for trying anpan from a **clone of this repo**. They are useful for contributors (tests and integration also reference some of these paths) and for anyone who wants to run the framework against **local source** before publishing.

## Prerequisites

Same as the main project: [Bun](https://bun.sh) >= 1.1.0.

## How these examples depend on the framework

Each example is a Bun package with `"@travvy/anpan": "../.."` in its [package.json](dev/package.json) (same idea as [examples/dev](dev/)). Imports use the scoped package name (`@travvy/anpan`, `@travvy/anpan/islands`) so module resolution matches a published install. After `bun install` in that folder, `node_modules/@travvy/anpan` points at the repo root. Entry files are `index.ts`; `bun run dev` runs the dev script (typically `bun run --hot index.ts`).

## Working directory matters

`createServer` / `createDevServer` options like `pagesDir` and `publicDir` are **relative to the process current working directory**, not to the entry file. Always start the server from **inside** the example directory, or use the repo helper script below (it `cd`s into the right folder first).

## From the repository root

After `bun install` at the repo root (for tests and tooling):

```sh
./scripts/run-example.sh dev
./scripts/run-example.sh blog
./scripts/run-example.sh react
./scripts/run-example.sh preact
./scripts/run-example.sh solidjs
```

## From inside an example

```sh
cd examples/<name>
bun install
bun run dev
```

## Ports and `PORT`

Default ports are chosen so you can run several examples at once on one machine:

| Example | Highlights | Default port | `bun install` in folder? |
|---------|------------|--------------|--------------------------|
| `dev` | `createDevServer`, middleware, `src/pages` layout, API route | 3000 | Yes |
| `blog` | `createServer`, richer content | 3001 | Yes |
| `react` | React islands (`jsxImportSource: "react"`) | 3002 | Yes |
| `preact` | Preact islands | 3003 | Yes |
| `solidjs` | Custom `jsxFramework` adapter (see [`solidjs/index.ts`](solidjs/index.ts)) | 3004 | Yes |

Every example reads `process.env.PORT` when set, so you can override defaults, e.g. `PORT=4000 bun run dev`.

## More documentation

Framework usage (pages, loaders, islands, etc.) is documented in the [project README](../README.md).
