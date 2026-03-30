#!/usr/bin/env bash

configs=(
    "tsconfig.json"
    "examples/react/tsconfig.json"
    "examples/preact/tsconfig.json"
    "examples/solidjs/tsconfig.json"
    "examples/blog/tsconfig.json"
    "examples/dev/tsconfig.json"
    "examples/__tests__/tsconfig.json"
)

for config in "${configs[@]}"; do
    echo "Running typecheck for $config"
    bun run tsc --noEmit -p "$config"
done
