#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"

source "$project_root/scripts/setup.sh"

example="$1"

if [ -z "$example" ]; then
    echo "usage: $0 <example>"
    echo "examples: blog, react, preact, solidjs, dev"
    exit 1
fi

example_dir="$project_root/examples/$example"

if [ ! -d "$example_dir" ]; then
    echo "example \"$example\" does not exist"
    exit 1
fi

run_in_dir "$example_dir" "bun run dev"
