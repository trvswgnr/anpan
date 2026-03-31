#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"

source "$project_root/scripts/utils.sh"

if [ ! -d "$project_root/node_modules" ]; then
    run_in_dir "$project_root" "bun install"
    run_in_dir "$project_root" "bun link"
fi

examples=(
    "blog"
    "react"
    "preact"
    "solidjs"
    "dev"
)

for example in "${examples[@]}"; do
    if [ ! -d "$project_root/examples/$example/node_modules" ]; then
        run_in_dir "$project_root/examples/$example" "bun install"
    run_in_dir "$project_root/examples/$example" "bun link @travvy/anpan"
    fi
done
