#!/usr/bin/env bash

function die() {
    local message="$1"
    if [ -n "$message" ]; then
        echo "$message"
    fi
    exit 1
}

function run_in_dir() {
    local dir="$1"
    local cmd="$2"
    pushd "$dir" &>/dev/null || die "failed to cd to $dir"
    bash -c "$cmd" || die "failed to run command in $dir"
    popd &>/dev/null || die "failed to popd"
}
