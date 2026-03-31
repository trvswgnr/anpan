# solidjs

Example app that uses **SolidJS** for `.island.tsx` components via a custom `jsxFramework` adapter (`createServer` in [`index.ts`](index.ts)). Pages keep anpan’s JSX (`jsxImportSource: "@travvy/anpan"`); islands are compiled with `babel-preset-solid` and hydrated with `solid-js/web`.

See the main project README, section **[Custom JSX framework](../../README.md#custom-jsx-framework)**, for `solidIslandTransform`, required Babel devDependencies, and the `clientMountSnippet` pattern (`__islandMount`, clearing SSR markup before `render`, `data-mounted`).

Default port is **3004** (override with `PORT`). From the repo root you can run `./scripts/run-example.sh solidjs` (see [`examples/README.md`](../README.md)).

## Install

```bash
bun install
```

## Run

```bash
bun run dev
```
