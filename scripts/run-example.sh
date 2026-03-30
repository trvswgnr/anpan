#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"

example="$1"

if [ -z "$example" ]; then
    echo "usage: $0 <example>"
    echo "examples: blog, react, preact, solidjs, dev"
    exit 1
fi

if [ ! -d "$project_root/examples/$example" ]; then
    echo "example $example does not exist"
    exit 1
fi

cd "$project_root/examples/$example" || {
    echo "failed to cd to examples/$example"
    exit 1
}

bun run --hot main.ts
