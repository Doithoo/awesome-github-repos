# Local Awesome List Generator Design

## Problem

The `Update awesome list` workflow depends on `simonecorsi/mawesome@v2`.
GitHub blocked that repository for a terms-of-service violation on 2026-06-25,
so runners now fail while downloading the action, before repository data is
read or generated.

## Goal

Replace the blocked action with code owned by this repository while preserving
the existing `data.json` and `data.md` outputs and the daily update workflow.

## Architecture

A dependency-free Node.js module will fetch the authenticated user's starred
repositories from GitHub's REST API. It will follow pagination links, group
repositories by primary language (using `miscellaneous` when no language is
reported), and write deterministic JSON and Markdown outputs.

The module will expose pure transformation and rendering functions for unit
tests. Its command-line entry point will read `API_TOKEN`, fetch live data, and
atomically replace both generated files only after all data has been fetched
and rendered successfully.

The workflow will use maintained official actions to check out the repository
and set up Node.js. It will run the local generator, then commit and push only
when `data.json` or `data.md` changed. The existing repository `GITHUB_TOKEN`
with `contents: write` will perform the push; `API_TOKEN` remains responsible
only for reading the user's private authenticated starred-list endpoint.

## Output Compatibility

- `data.json` remains an object keyed by language with arrays of GitHub
  repository objects, so the existing static application needs no changes.
- `data.md` retains the current header, table of contents, per-language
  sections, and repository links/descriptions.
- Language groups preserve the order in which languages first appear in the
  GitHub response, and repositories preserve starred-list response order.
- Missing descriptions render as an empty string rather than the text `null`.

## Error Handling

The generator fails with a clear message when `API_TOKEN` is absent, a GitHub
request is unsuccessful, pagination is malformed, or output cannot be written.
No generated file is replaced until fetching and rendering have both
completed, preventing partial updates.

## Testing

Node's built-in test runner will cover pagination, grouping, miscellaneous
language handling, deterministic JSON, Markdown escaping/empty descriptions,
and HTTP error propagation. A workflow-focused test will assert that the
blocked action is gone and that the local generator receives the required
secret. Verification will include the full test suite, syntax checks, and a
manual GitHub Actions dispatch after the fix is pushed.

## Scope

This change does not redesign the static site, change its data contract, rotate
secrets, or introduce a package dependency. It only replaces the unavailable
generation and commit path.
