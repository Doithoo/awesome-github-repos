# Repository Cleanup Design

## Goal

Make the repository easier to scan without changing the static Pages architecture,
catalog behavior, automation, or developer workflow.

## Approaches Considered

1. Light cleanup: remove unused and process-only files while preserving the current
   source layout. This is the selected approach because it reduces clutter without
   introducing a build step or changing deployment paths.
2. Full source reorganization: move browser files under `src/` and generated files
   under a public output directory. Rejected because this static site deploys directly
   from the repository root and would gain complexity without a functional benefit.
3. Local-only cleanup: delete ignored artifacts but leave tracked legacy files in place.
   Rejected because `template/README.ejs` and the implementation-plan archive would
   continue to make the public repository harder to understand.

## Tracked Files

- Delete `template/README.ejs`; no runtime, generator, workflow, or test imports it.
- Delete the complete `docs/superpowers/` process-document archive, including this
  temporary cleanup specification, after it has been reviewed. The Git history remains
  the durable record of the implementation plans and approved cleanup boundary.
- Remove the special `docs/superpowers/` exclusion from the repository structure test,
  because the directory will no longer exist.
- Keep `index.html`, `app.js`, `styles.css`, `data.json`, and `data.md` at the repository
  root so GitHub Pages can continue publishing the static application directly.
- Keep `lib/`, `scripts/`, `test/`, `e2e/`, `assets/`, and `.github/` as separate,
  purpose-specific directories.

## Local Artifacts

- Delete ignored `.superpowers/`, `.worktrees/`, and `test-results/` directories.
- Keep ignored `node_modules/` so local verification remains immediately available.
- Do not change `.gitignore`; it already prevents all local artifacts from being
  committed again.

## Verification

- Confirm `git status` contains only the intended tracked cleanup before committing.
- Run `npm run test:all` after the cleanup.
- Confirm `git diff --check` passes and the final tracked tree matches the documented
  architecture in `README.md`.
- Push the cleanup only after tests pass, preserving the current `main` history.

## Non-Goals

- No UI, data schema, generator, workflow behavior, dependency, or deployment changes.
- No workflow filename renames.
- No new build system or source directory.
