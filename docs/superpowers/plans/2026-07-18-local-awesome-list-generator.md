# Local Awesome List Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore daily starred-repository updates without relying on the blocked `simonecorsi/mawesome` action.

**Architecture:** A dependency-free Node.js module fetches every page of `/user/starred`, reduces API repository objects to the existing `data.json` schema, groups them by primary language, and renders JSON and Markdown. GitHub Actions runs tests and the generator, then commits only changed generated files using the built-in repository token.

**Tech Stack:** Node.js 22, built-in `fetch`, `node:test`, GitHub Actions, GitHub REST API

---

## File Structure

- Create `scripts/update-awesome-list.mjs`: API pagination, repository projection, grouping, renderers, atomic output writer, and CLI entry point.
- Create `test/update-awesome-list.test.mjs`: unit and integration-style tests using Node's built-in test runner and injected fetch implementations.
- Create `test/workflow.test.mjs`: workflow regression assertions that prevent reintroducing the blocked action and verify token wiring.
- Modify `package.json`: add `test` and `update-awesome-list` scripts without adding dependencies.
- Modify `.github/workflows/main.yml`: replace the blocked action with official setup actions and local commands.

### Task 1: Starred Repository Fetching and Grouping

**Files:**
- Create: `test/update-awesome-list.test.mjs`
- Create: `scripts/update-awesome-list.mjs`

- [ ] **Step 1: Write failing pagination and grouping tests**

Add tests that import `fetchStarredRepositories`, `projectRepository`, and `groupRepositories`. The fake fetch returns two pages using a `Link: <...page=2>; rel="next"` header. Assert that both pages are returned in order, request headers include `Bearer test-token`, only the established repository fields survive projection, and a missing language is grouped under `miscellaneous`.

```js
test('fetches every starred repository page in response order', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const page = new URL(url).searchParams.get('page');
    return page === '2'
      ? response([{ id: 2, language: null }])
      : response([{ id: 1, language: 'JavaScript' }],
          '<https://api.github.com/user/starred?per_page=100&page=2>; rel="next"');
  };

  const repositories = await fetchStarredRepositories('test-token', fetchImpl);

  assert.deepEqual(repositories.map(({ id }) => id), [1, 2]);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/update-awesome-list.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the generator module does not exist.

- [ ] **Step 3: Implement minimal fetching and grouping**

Export these functions from `scripts/update-awesome-list.mjs`:

```js
export async function fetchStarredRepositories(token, fetchImpl = fetch) { /* follow rel=next */ }
export function projectRepository(repository) { /* return existing schema fields */ }
export function groupRepositories(repositories) { /* Map language to projected repos */ }
```

Use `/user/starred?per_page=100&page=1`, GitHub API version `2022-11-28`, and throw an error containing status and response text for non-2xx responses. Reject non-array response bodies.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `node --test test/update-awesome-list.test.mjs`

Expected: all pagination, projection, grouping, and API error tests PASS.

### Task 2: Compatible JSON and Markdown Rendering

**Files:**
- Modify: `test/update-awesome-list.test.mjs`
- Modify: `scripts/update-awesome-list.mjs`

- [ ] **Step 1: Write failing renderer tests**

Test `renderJson` and `renderMarkdown` with JavaScript, C++, C, and language-less repositories. Assert two-space JSON indentation and trailing newline; table-of-contents anchors `#javascript`, `#c`, `#c-1`, and `#miscellaneous`; null descriptions render after ` -` with no `null`; and Markdown-significant language characters are escaped in headings.

```js
assert.match(markdown, /\* \[C\+\+\]\(#c\)/);
assert.match(markdown, /## C\+\+/);
assert.doesNotMatch(markdown, /null/);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='render' test/update-awesome-list.test.mjs`

Expected: FAIL because renderer exports do not exist.

- [ ] **Step 3: Implement minimal deterministic renderers**

Implement a GitHub-style heading slug counter, render the existing badge/header and table of contents, and emit one repository list item separated by a blank line. Serialize the grouped object with `JSON.stringify(value, null, 2) + '\n'`.

- [ ] **Step 4: Run the full generator tests and verify GREEN**

Run: `node --test test/update-awesome-list.test.mjs`

Expected: all tests PASS without warnings.

### Task 3: Safe CLI Output Generation

**Files:**
- Modify: `test/update-awesome-list.test.mjs`
- Modify: `scripts/update-awesome-list.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing output and configuration tests**

Use a temporary directory to test `writeOutputs`: both `data.json` and `data.md` receive complete rendered content and no temporary files remain. Spawn the CLI without `API_TOKEN` and assert a non-zero exit code plus `API_TOKEN is required` on stderr.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='output|API_TOKEN' test/update-awesome-list.test.mjs`

Expected: FAIL because the writer and CLI validation are missing.

- [ ] **Step 3: Implement writer, CLI, and package scripts**

Write each output to a same-directory temporary file and rename it into place after both render strings exist. Detect direct CLI execution with `import.meta.url`, validate `process.env.API_TOKEN`, and set `process.exitCode = 1` after printing concise errors. Add:

```json
"test": "node --test",
"update-awesome-list": "node scripts/update-awesome-list.mjs"
```

- [ ] **Step 4: Run all local tests and syntax checks**

Run: `npm test && node --check scripts/update-awesome-list.mjs`

Expected: all tests PASS and syntax checking exits 0.

### Task 4: Replace and Verify the GitHub Actions Workflow

**Files:**
- Create: `test/workflow.test.mjs`
- Modify: `.github/workflows/main.yml`

- [ ] **Step 1: Write the failing workflow regression test**

Read `.github/workflows/main.yml` and assert it does not contain `simonecorsi/mawesome`, uses `actions/checkout@v4` and `actions/setup-node@v4`, runs `npm test` and `npm run update-awesome-list`, passes `${{ secrets.API_TOKEN }}`, and stages only `data.json data.md` before committing.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `node --test test/workflow.test.mjs`

Expected: FAIL because the workflow still references `simonecorsi/mawesome@v2`.

- [ ] **Step 3: Replace the blocked action**

Use official checkout/setup actions, Node 22, a test step, a generation step with `API_TOKEN`, and a commit step that configures `github-actions[bot]`, stages only generated files, skips the commit when unchanged, and pushes otherwise. Keep `permissions.contents: write`, schedule, and manual dispatch.

- [ ] **Step 4: Run repository verification**

Run: `npm test && node --check scripts/update-awesome-list.mjs && git diff --check`

Expected: all tests PASS, syntax exits 0, and no whitespace errors are reported.

- [ ] **Step 5: Commit and publish the fix**

Stage only the generator, tests, package manifest, workflow, and plan. Commit with `fix(ci): replace blocked awesome list action`, push `main`, manually dispatch `Update awesome list`, and watch the run through completion.

- [ ] **Step 6: Validate remote behavior**

Run `gh run view <run-id> --log-failed` only if needed. Confirm the run concludes `success`, a generated-data commit is created only when stars changed, and the Pages workflow is triggered by the push.
