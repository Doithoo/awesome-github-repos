# Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove obsolete tracked process files and ignored local artifacts without changing the static site, generated catalog, automation, or deployment layout.

**Architecture:** Preserve the current root-deployed static application and its purpose-specific source and test directories. Add one tracked-tree regression test, delete the unused template and process-document archive, and retain Git history as the record of removed plans.

**Tech Stack:** Node.js 22, node:test, Git, Playwright Chromium, static GitHub Pages

---

### Task 1: Lock the clean tracked-tree contract

**Files:**
- Modify: `test/site-structure.test.mjs`
- Test: `test/site-structure.test.mjs`

- [ ] **Step 1: Add the failing tracked-tree test**

Add this test after `active page contains no legacy ownership or unsafe rendering hook`:

```js
test('tracked tree excludes obsolete templates and process documents', () => {
  const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);

  assert.equal(trackedFiles.includes('template/README.ejs'), false);
  assert.equal(
    trackedFiles.some((relativePath) => relativePath.startsWith('docs/superpowers/')),
    false,
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test --test-name-pattern='tracked tree excludes obsolete' test/site-structure.test.mjs`

Expected: FAIL because `template/README.ejs` and `docs/superpowers/` are still tracked.

### Task 2: Remove tracked repository clutter

**Files:**
- Delete: `template/README.ejs`
- Delete: `docs/superpowers/plans/2026-07-18-comprehensive-redesign.md`
- Delete: `docs/superpowers/plans/2026-07-18-local-awesome-list-generator.md`
- Delete: `docs/superpowers/plans/2026-07-18-repository-cleanup.md`
- Delete: `docs/superpowers/specs/2026-07-18-comprehensive-redesign-design.md`
- Delete: `docs/superpowers/specs/2026-07-18-local-awesome-list-generator-design.md`
- Delete: `docs/superpowers/specs/2026-07-18-repository-cleanup-design.md`
- Modify: `test/site-structure.test.mjs`

- [ ] **Step 1: Remove the obsolete files**

Delete the complete `template/` and `docs/superpowers/` tracked contents listed above. Git history preserves every removed document.

- [ ] **Step 2: Remove the obsolete process-document exception**

In `active project files contain no legacy owner or domain references`, delete:

```js
if (relativePath.startsWith('docs/superpowers/')) continue;
```

- [ ] **Step 3: Run the focused structural tests**

Run: `node --test --test-name-pattern='tracked tree excludes obsolete|active project files contain no legacy' test/site-structure.test.mjs`

Expected: 2 matching tests pass with no failures.

### Task 3: Remove ignored local artifacts

**Files:**
- Delete locally: `.superpowers/`
- Delete locally: `.worktrees/`
- Delete locally: `test-results/`
- Preserve locally: `node_modules/`

- [ ] **Step 1: Delete ignored transient directories**

Remove `.superpowers/`, `.worktrees/`, and `test-results/`. Do not remove `node_modules/`.

- [ ] **Step 2: Verify ignore coverage remains intact**

Run: `git check-ignore -v .superpowers .worktrees test-results node_modules`

Expected: all four paths are matched by root entries in `.gitignore`.

### Task 4: Verify and publish the cleanup

**Files:**
- Modify: `test/site-structure.test.mjs`
- Delete: the tracked files in Task 2

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test:all`

Expected: all Node tests and all 34 Playwright tests pass on desktop and mobile Chromium.

- [ ] **Step 2: Verify the final diff and tree**

Run: `git diff --check`

Expected: exit 0 with no output.

Run: `git status --short`

Expected: only `test/site-structure.test.mjs` modified and the approved process/template files deleted.

- [ ] **Step 3: Commit the cleanup**

```bash
git add -A docs/superpowers template test/site-structure.test.mjs
git commit -m "chore: streamline repository structure"
```

- [ ] **Step 4: Push current main**

Run: `git push origin main`

Expected: `main` advances to the cleanup commit without a force push.
