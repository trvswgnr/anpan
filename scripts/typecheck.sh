#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"

source "$project_root/scripts/utils.sh"

configs=(
    "tsconfig.json"
    "examples/react/tsconfig.json"
    "examples/preact/tsconfig.json"
    "examples/solidjs/tsconfig.json"
    "examples/blog/tsconfig.json"
    "examples/dev/tsconfig.json"
)

for config in "${configs[@]}"; do
    echo "Running typecheck for $config"
    bun run tsc --noEmit -p "$config"
done
