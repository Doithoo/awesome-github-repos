# Comprehensive Repository Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic repository showcase with the approved secure, tested, performant Graphic Signal search gallery while preserving dependency-free data generation and GitHub Pages deployment.

**Architecture:** Keep a build-free ES module frontend. Put deterministic repository transformations in `lib/catalog.mjs`, safe DOM construction in `lib/view.mjs`, and browser coordination in `app.js`; keep the GitHub API generator separate and atomic. Test pure logic with Node and user flows with Playwright.

**Tech Stack:** HTML5, CSS3, native JavaScript ES modules, Node.js 22 test runner, Playwright, GitHub Actions, GitHub Pages.

---

## File Map

- Create `lib/catalog.mjs`: validation, normalization, search, filtering, sorting, pagination, formatting, and URL policy.
- Create `lib/view.mjs`: safe DOM factories and application-state rendering.
- Rewrite `app.js`: data loading, state ownership, event handling, and render coordination.
- Rewrite `index.html`: semantic Graphic Signal shell.
- Rewrite `styles.css`: approved responsive visual system.
- Delete `index-simple.html`: remove the unsafe duplicate frontend.
- Modify `scripts/update-awesome-list.mjs`: reduced data contract and Doithoo Markdown ownership.
- Modify `test/update-awesome-list.test.mjs`: reduced contract and ownership assertions.
- Create `test/catalog.test.mjs`: deterministic frontend logic tests.
- Create `test/site-structure.test.mjs`: static security, ownership, and semantic-shell assertions.
- Create `e2e/catalog.spec.mjs`: rendered behavior and viewport smoke tests.
- Create `playwright.config.mjs`: local server and browser test configuration.
- Modify `package.json` and create `package-lock.json`: reproducible Playwright tooling and scripts.
- Modify `.github/workflows/main.yml`: install locked dependencies and run the complete test suite.
- Modify `.github/workflows/static.yml`: gate workflow-run deployments on success.
- Create `.github/dependabot.yml`: maintain npm and Actions versions.
- Modify `.gitignore`: ignore `.superpowers/` visual-companion sessions and Playwright artifacts.
- Rewrite `README.md`, update `CHANGELOG.md`, `package.json`, `template/README.ejs`, and `LICENSE`: ownership and usage documentation.

### Task 1: Deterministic Catalog Model

**Files:**
- Create: `lib/catalog.mjs`
- Create: `test/catalog.test.mjs`

- [ ] **Step 1: Write failing normalization, search, filter, sort, pagination, and URL tests**

Create fixtures with two languages and repositories whose name, description, owner, topic, and language exercise separate search fields. Import these public functions:

```js
import {
  filterRepositories,
  formatNumber,
  getSafeUrl,
  normalizeRepositories,
  paginateRepositories,
  sortRepositories,
} from '../lib/catalog.mjs';
```

Assert the following exact behaviors:

```js
assert.deepEqual(normalizeRepositories(grouped).map(({ fullName }) => fullName), [
  'openai/codex',
  'vercel/next.js',
]);
assert.deepEqual(filterRepositories(repositories, { query: 'terminal rust', language: '' }).map(r => r.id), [1]);
assert.deepEqual(filterRepositories(repositories, { query: '', language: 'JavaScript' }).map(r => r.id), [2]);
assert.deepEqual(sortRepositories(repositories, 'recently-starred').map(r => r.id), [1, 2]);
assert.deepEqual(sortRepositories(repositories, 'stars').map(r => r.id), [2, 1]);
assert.deepEqual(sortRepositories(repositories, 'updated').map(r => r.id), [2, 1]);
assert.deepEqual(sortRepositories(repositories, 'name').map(r => r.id), [1, 2]);
assert.deepEqual(paginateRepositories(repositories, 1), { visible: [repositories[0]], hasMore: true });
assert.equal(formatNumber(1250), '1.3K');
assert.equal(getSafeUrl('https://github.com/openai/codex', { githubOnly: true }), 'https://github.com/openai/codex');
assert.equal(getSafeUrl('javascript:alert(1)'), null);
assert.equal(getSafeUrl('https://example.com', { githubOnly: true }), null);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/catalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/catalog.mjs`.

- [ ] **Step 3: Implement the catalog module**

Implement these stable interfaces:

```js
export const PAGE_SIZE = 24;

export function getSafeUrl(value, { githubOnly = false } = {}) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (githubOnly && url.hostname !== 'github.com') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeRepositories(input) {
  if (!input || (typeof input !== 'object' && !Array.isArray(input))) {
    throw new TypeError('Repository data must be an array or grouped object');
  }
  const source = Array.isArray(input) ? input : Object.values(input).flatMap(group => {
    if (!Array.isArray(group)) throw new TypeError('Repository groups must be arrays');
    return group;
  });
  return source.filter(repo => repo && Number.isSafeInteger(repo.id) && typeof repo.name === 'string')
    .map((repo, sourceIndex) => ({
      id: repo.id,
      name: repo.name,
      fullName: typeof repo.full_name === 'string' ? repo.full_name : repo.name,
      description: typeof repo.description === 'string' ? repo.description : '',
      language: typeof repo.language === 'string' && repo.language ? repo.language : 'Other',
      topics: Array.isArray(repo.topics) ? repo.topics.filter(topic => typeof topic === 'string') : [],
      stars: Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0,
      createdAt: repo.created_at ?? null,
      updatedAt: repo.updated_at ?? null,
      homepage: getSafeUrl(repo.homepage),
      repositoryUrl: getSafeUrl(repo.html_url, { githubOnly: true }),
      owner: {
        login: typeof repo.owner?.login === 'string' ? repo.owner.login : 'unknown',
        avatarUrl: getSafeUrl(repo.owner?.avatar_url),
        profileUrl: getSafeUrl(repo.owner?.html_url, { githubOnly: true }),
      },
      sourceIndex,
    }));
}
```

Add token-based AND search, exact-language filtering, stable sorting with `sourceIndex` as tie-breaker, `paginateRepositories(repositories, visibleCount)`, `getLanguageCounts`, `formatNumber`, and `formatRelativeDate`.

- [ ] **Step 4: Run focused and full unit tests**

Run: `node --test test/catalog.test.mjs test/update-awesome-list.test.mjs test/workflow.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the model**

```bash
git add lib/catalog.mjs test/catalog.test.mjs
git commit -m "feat(catalog): add tested repository model"
```

### Task 2: Reduced Generator Contract

> **Final implementation amendment:** The public projection has 13 top-level fields, with `starred_order` last. `groupRepositories` iterates the original GitHub API array with its raw index and calls `projectRepository(repository, starredOrder)` for each explicitly public repository; skipped entries may leave ordinal gaps. `projectRepository` requires a safe non-negative integer, and the catalog restores cross-language recently-starred order from that value. Consequently, checked-in data must be regenerated from the authenticated API with the final explicit-public filter. Flatten order remains only a compatibility fallback for legacy or array fixtures.

**Files:**
- Modify: `scripts/update-awesome-list.mjs:61-88,128-154`
- Modify: `test/update-awesome-list.test.mjs:120-190`
- Modify: `template/README.ejs`
- Modify: `data.json`
- Modify: `data.md`

- [ ] **Step 1: Change generator tests to the reduced contract and Doithoo ownership**

Replace the expected projected keys with:

```js
[
  'id', 'name', 'full_name', 'owner', 'html_url', 'description', 'homepage',
  'stargazers_count', 'language', 'topics', 'created_at', 'updated_at',
  'starred_order',
]
```

Expect owner keys `['login', 'avatar_url', 'html_url']`. Add:

```js
assert.match(renderMarkdown(grouped), /https:\/\/github\.com\/Doithoo/);
assert.doesNotMatch(renderMarkdown(grouped), /tonngw/);
```

- [ ] **Step 2: Run the generator test and verify RED**

Run: `node --test test/update-awesome-list.test.mjs`

Expected: FAIL because the old projection contains additional fields and Markdown points to `tonngw`.

- [ ] **Step 3: Reduce `projectRepository`, preserve source ordinals, and update Markdown ownership**

Return only the specified browser contract, including the three owner fields and final `starred_order`. Require `projectRepository(repository, starredOrder)` to receive a safe non-negative integer. Have `groupRepositories` pass the original raw API array index while filtering for explicitly public repositories, so non-public gaps do not disturb relative public order. Replace both badge targets with `https://github.com/Doithoo`. Make `template/README.ejs` contain the same header.

- [ ] **Step 4: Regenerate checked-in data from the authenticated source**

The following original offline compaction instruction is **superseded and must not be used for final data provenance**. Grouped legacy data cannot reconstruct the original cross-language starred order, and its reduced records cannot prove the final explicit-public metadata checks.

Historical command (invalid for the final contract):

```bash
node --input-type=module -e "
  import { readFile, writeFile } from 'node:fs/promises';
  import {
    projectRepository,
    renderJson,
    renderMarkdown,
  } from './scripts/update-awesome-list.mjs';
  const grouped = JSON.parse(await readFile('data.json', 'utf8'));
  const compacted = Object.fromEntries(
    Object.entries(grouped).map(([language, repositories]) => [
      language,
      repositories.map(projectRepository),
    ]),
  );
  await Promise.all([
    writeFile('data.json', renderJson(compacted), 'utf8'),
    writeFile('data.md', renderMarkdown(compacted), 'utf8'),
  ]);
"
```

After confirming `gh api user --jq .login` returns `Doithoo`, regenerate with the final generator:

```bash
API_TOKEN="$(gh auth token)" npm run update-awesome-list
```

Expected: repository count remains 688, language count remains 29, and `data.json` is materially smaller than 918,519 bytes.

- [ ] **Step 5: Run generator tests and validate generated files**

Run: `node --test test/update-awesome-list.test.mjs`

Run: `node -e 'const d=require("./data.json"); console.log(Object.values(d).flat().length)'`

Expected: tests PASS and command prints `688`.

- [ ] **Step 6: Commit the generator contract**

```bash
git add scripts/update-awesome-list.mjs test/update-awesome-list.test.mjs template/README.ejs data.json data.md
git commit -m "perf(data): reduce generated repository payload"
```

### Task 3: Semantic And Secure Page Shell

**Files:**
- Rewrite: `index.html`
- Delete: `index-simple.html`
- Create: `test/site-structure.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Write static structure and ownership tests**

Read `index.html`, `.gitignore`, and the project root directory. The view-module security assertions are added separately in Task 4 after that module is introduced. Assert:

```js
assert.match(html, /<main[^>]*id="catalog"/);
assert.match(html, /id="searchInput"/);
assert.match(html, /id="languageFilter"/);
assert.match(html, /id="sortSelect"/);
assert.match(html, /id="loadMoreButton"/);
assert.match(html, /<script type="module" src="app\.js"><\/script>/);
assert.doesNotMatch(html, /tonngw|innerHTML/);
assert.equal(await exists(path.join(projectRoot, 'index-simple.html')), false);
assert.match(gitignore, /^\.superpowers\/$/m);
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `node --test test/site-structure.test.mjs`

Expected: FAIL on old ownership, missing semantic IDs, non-module script, and existing `index-simple.html`.

- [ ] **Step 3: Replace the HTML shell and delete the duplicate page**

The new shell must contain:

```html
<header class="site-header">
  <nav class="site-nav" aria-label="Primary">
    <a class="brand" href="#catalog">DOITHOO / STARS</a>
    <a class="icon-link" href="https://github.com/Doithoo/awesome-github-repos"
       target="_blank" rel="noopener noreferrer" aria-label="View source on GitHub"></a>
  </nav>
  <div class="search-panel">
    <p class="eyebrow" id="collectionStats">Starred repository collection</p>
    <h1>Doithoo's Starred Repositories</h1>
    <label class="search-control" for="searchInput">
      <span class="sr-only">Search repositories</span>
      <input id="searchInput" type="search" autocomplete="off"
             placeholder="Search by name, topic, owner, or language">
    </label>
  </div>
</header>
<main id="catalog">
  <section class="catalog-toolbar" aria-label="Repository filters">
    <label>Language <select id="languageFilter"><option value="">All languages</option></select></label>
    <label>Sort <select id="sortSelect">
      <option value="recently-starred">Recently starred</option>
      <option value="stars">Most stars</option>
      <option value="updated">Recently updated</option>
      <option value="name">Name A-Z</option>
    </select></label>
  </section>
  <div id="quickFilters" aria-label="Popular languages"></div>
  <p id="resultSummary" aria-live="polite"></p>
  <section id="repositoryGrid" aria-label="Repositories"></section>
  <button id="loadMoreButton" type="button" hidden>Load more</button>
  <section id="statusPanel" aria-live="polite"></section>
</main>
<footer id="footer"></footer>
<script type="module" src="app.js"></script>
```

Use Lucide-compatible inline symbol markup only for the static GitHub/search icons; give every icon-only link an accessible name. Delete `index-simple.html`. Add `.superpowers/`, `playwright-report/`, and `test-results/` to `.gitignore`.

- [ ] **Step 4: Run the structure test**

Run: `node --test test/site-structure.test.mjs`

Expected: PASS for shell, ownership, deletion, and ignore rules.

- [ ] **Step 5: Commit the shell**

```bash
git add index.html index-simple.html test/site-structure.test.mjs .gitignore
git commit -m "refactor(ui): replace legacy page shell"
```

### Task 4: Safe DOM View

**Files:**
- Create: `lib/view.mjs`
- Modify: `test/site-structure.test.mjs`

- [ ] **Step 1: Add a failing static security test**

Assert that `lib/view.mjs` exists and contains no `.innerHTML`, `insertAdjacentHTML`, or string assignment to `href` outside the safe normalized fields. Assert the module exports:

```js
import { createRepositoryCard, renderLanguageOptions, renderQuickFilters } from '../lib/view.mjs';
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/site-structure.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/view.mjs`.

- [ ] **Step 3: Implement safe element factories**

Use one local helper:

```js
function element(tagName, { className, text, attributes = {} } = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  return node;
}
```

`createRepositoryCard(repository)` must create an `article`, safe repository and owner anchors only when normalized URLs exist, a lazy 40x40 avatar, description, up to three topic anchors constructed with `https://github.com/topics/${encodeURIComponent(topic)}`, language, formatted stars, relative date, and optional safe homepage icon link. All API text uses `textContent`.

`renderLanguageOptions(select, counts, selected)`, `renderQuickFilters(container, counts, selected, limit = 6)`, `renderRepositoryGrid(grid, repositories)`, `renderSummary`, `renderLoading`, `renderError`, and `renderEmpty` use document fragments and replace children with `replaceChildren`.

- [ ] **Step 4: Run static and catalog tests**

Run: `node --test test/site-structure.test.mjs test/catalog.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit safe rendering**

```bash
git add lib/view.mjs test/site-structure.test.mjs
git commit -m "fix(ui): render repository data safely"
```

### Task 5: Tested Application Controller

**Files:**
- Rewrite: `app.js`
- Modify: `test/site-structure.test.mjs`

- [ ] **Step 1: Add controller contract assertions**

Assert `app.js` imports from both modules, contains `AbortController`, uses a 10,000 ms timeout, contains no `.innerHTML`, no `setInterval`, no positive `tabIndex`, and no keyboard interception for `Ctrl/Cmd+R`.

- [ ] **Step 2: Run the structure test and verify RED**

Run: `node --test test/site-structure.test.mjs`

Expected: FAIL against the legacy 2,749-line controller.

- [ ] **Step 3: Implement the controller**

Create one `CatalogApp` class with stable state:

```js
this.state = {
  repositories: [],
  query: '',
  language: '',
  sort: 'recently-starred',
  visibleCount: PAGE_SIZE,
  status: 'loading',
  error: null,
};
```

Bind each static control once in `init()`. Debounce search by 175 ms. Language select and delegated quick-filter clicks write `state.language`. Sort writes `state.sort`. `Load more` adds `PAGE_SIZE`. Clear resets query and language. Retry calls `loadData()` without rebinding.

`loadData()` fetches `data.json` with an abort timeout and assigns one of these exact user messages:

```js
'The repository list took too long to load.'
'The repository list could not be downloaded.'
'The repository data is not valid.'
```

`render()` derives filtered, sorted, and paginated results through `lib/catalog.mjs`, updates controls through `lib/view.mjs`, and displays `Load more` only when `hasMore` is true.

- [ ] **Step 4: Run all Node tests and syntax checks**

Run: `npm test`

Run: `node --check app.js && node --check lib/catalog.mjs && node --check lib/view.mjs`

Expected: all tests and checks PASS.

- [ ] **Step 5: Commit the controller**

```bash
git add app.js test/site-structure.test.mjs
git commit -m "refactor(ui): add focused catalog controller"
```

### Task 6: Graphic Signal Visual System

**Files:**
- Rewrite: `styles.css`

- [ ] **Step 1: Add visual invariants to the structure test**

Read `styles.css` and assert the presence of `--color-primary: #214bc8`, `--color-signal: #c3322b`, `prefers-reduced-motion`, mobile and desktop media queries, stable avatar dimensions, and a maximum card radius of 8px. Assert old parallax, toast, skeleton duplication, and virtual-scroll selectors are absent.

- [ ] **Step 2: Run the structure test and verify RED**

Run: `node --test test/site-structure.test.mjs`

Expected: FAIL because the legacy 3,757-line stylesheet does not implement the approved token system.

- [ ] **Step 3: Implement the complete responsive stylesheet**

Start with these tokens and build all shell states from them:

```css
:root {
  --color-canvas: #f8f9fb;
  --color-surface: #ffffff;
  --color-ink: #17191d;
  --color-muted: #626875;
  --color-line: #cbd0da;
  --color-primary: #214bc8;
  --color-signal: #c3322b;
  --color-focus: #214bc8;
  --shadow-card: 2px 2px 0 #dfe3ec;
  --radius-card: 6px;
  --content-width: 1180px;
}
```

Use a constrained navigation and content width, a full-width pale blue search band, a sticky desktop filter toolbar that becomes normal-flow on mobile, a two-column card grid above 760px, a one-column grid below 760px, fixed 40px avatars, bounded descriptions, visible focus rings, and stable button dimensions. Add skeleton, error, empty, and disabled states. Do not add gradients, decorative blobs, viewport-based font scaling, negative letter spacing, or nested cards.

Disable transitions and animations inside:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run static tests**

Run: `node --test test/site-structure.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the visual system**

```bash
git add styles.css test/site-structure.test.mjs
git commit -m "feat(ui): apply Graphic Signal redesign"
```

### Task 7: Browser Behavior Tests

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `playwright.config.mjs`
- Create: `e2e/catalog.spec.mjs`

- [ ] **Step 1: Add locked Playwright development tooling**

Add `@playwright/test` as a dev dependency and these scripts:

```json
{
  "test": "node --test",
  "test:e2e": "playwright test",
  "test:all": "npm test && npm run test:e2e"
}
```

Run: `npm install --save-dev @playwright/test`

Run: `npx playwright install chromium`

Expected: `package-lock.json` is created and Chromium installs successfully.

- [ ] **Step 2: Configure the local web server and viewports**

Configure Playwright to run `python3 -m http.server 4173`, use `http://127.0.0.1:4173`, retain traces on failure, and define desktop Chromium plus a 390x844 mobile project.

- [ ] **Step 3: Write browser tests**

Cover these exact flows:

```js
test('loads 24 cards and filters by exact language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Doithoo's Starred Repositories" })).toBeVisible();
  await expect(page.locator('.repository-card')).toHaveCount(24);
  await page.getByLabel('Language').selectOption('JavaScript');
  await expect(page.locator('.repository-card').first()).toContainText('JavaScript');
  await expect(page.locator('.repository-card').filter({ hasNotText: 'JavaScript' })).toHaveCount(0);
});

test('search, sort, clear, and load more update results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.repository-card')).toHaveCount(48);
  await page.getByRole('searchbox').fill('typescript');
  await expect(page.locator('.repository-card').first()).toBeVisible();
  await page.getByLabel('Sort').selectOption('stars');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.repository-card')).toHaveCount(24);
});
```

Also collect `page.on('console')` errors, test a mocked unsafe homepage value is not rendered as a link, and assert no horizontal overflow at both configured viewports.

- [ ] **Step 4: Run browser tests and fix only observed failures**

Run: `npm run test:e2e`

Expected: all desktop and mobile tests PASS with no relevant console errors.

- [ ] **Step 5: Run the complete suite**

Run: `npm run test:all`

Expected: Node and Playwright suites PASS.

- [ ] **Step 6: Commit browser coverage**

```bash
git add package.json package-lock.json playwright.config.mjs e2e/catalog.spec.mjs .gitignore
git commit -m "test(ui): cover catalog browser flows"
```

### Task 8: Workflow Hardening

**Files:**
- Modify: `.github/workflows/main.yml`
- Modify: `.github/workflows/static.yml`
- Modify: `test/workflow.test.mjs`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Add failing workflow policy tests**

Assert the update workflow runs `npm ci`, then `npm run test:all`, then generation. Assert the Pages deploy job contains:

```yaml
if: >-
  github.event_name != 'workflow_run' ||
  github.event.workflow_run.conclusion == 'success'
```

Assert Dependabot includes weekly `npm` and `github-actions` ecosystems.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `node --test test/workflow.test.mjs`

Expected: FAIL because CI does not install locked dependencies, does not run E2E tests, and does not gate failed workflow runs.

- [ ] **Step 3: Update workflows and Dependabot**

Add `npm ci` after Node setup and replace `npm test` with `npm run test:all`. Keep the API token scoped only to the generation step. Add the success condition to the Pages deploy job. Configure weekly Dependabot checks with a limit of five open PRs per ecosystem.

Keep official Actions on their current stable major versions unless a verified immutable SHA and version comment are available during implementation; Dependabot must maintain all references.

- [ ] **Step 4: Run workflow and complete tests**

Run: `npm run test:all`

Expected: all tests PASS.

- [ ] **Step 5: Commit CI hardening**

```bash
git add .github/workflows/main.yml .github/workflows/static.yml .github/dependabot.yml test/workflow.test.mjs
git commit -m "ci: validate UI before update and deployment"
```

### Task 9: Ownership And Documentation

**Files:**
- Modify: `package.json`
- Rewrite: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `LICENSE`
- Modify: `index.html`
- Modify: `test/site-structure.test.mjs`

- [ ] **Step 1: Add failing ownership and documentation checks**

Search active files, excluding historical design documents and Git history, and assert there are no `tonngw` or `awesome.tonngw.com` references. Assert README contains `https://doithoo.github.io/awesome-github-repos/`, `API_TOKEN`, minimal token guidance, local test commands, and no links to absent files.

- [ ] **Step 2: Run the structure test and verify RED**

Run: `node --test test/site-structure.test.mjs`

Expected: FAIL on legacy package metadata, README, license, and active links.

- [ ] **Step 3: Rewrite active ownership and usage documentation**

Set package repository, bugs, homepage, and author fields to Doithoo. Write README sections in Chinese followed by English covering purpose, live site, local development, update workflow, minimal token requirements, Pages setup, tests, and license. Remove dead Documentation/Contributing links and do not recommend broad repository or workflow token permissions.

Add an `Unreleased` changelog section summarizing the secure modular frontend, reduced payload, UI redesign, browser coverage, and workflow gate. Preserve original MIT attribution and add an explicit modification copyright line for Doithoo rather than deleting the original copyright.

- [ ] **Step 4: Run ownership scan and complete tests**

Run: `rg -n 'tonngw|awesome\.tonngw\.com' --glob '!docs/superpowers/**' --glob '!LICENSE' .`

Expected: no matches.

Run: `npm run test:all`

Expected: all tests PASS.

- [ ] **Step 5: Commit documentation**

```bash
git add package.json README.md CHANGELOG.md LICENSE index.html test/site-structure.test.mjs
git commit -m "docs: align repository with Doithoo ownership"
```

### Task 10: Final Visual And Repository Verification

**Files:**
- Modify only files implicated by observed verification failures.

- [ ] **Step 1: Run all automated verification from a clean install**

Run: `npm ci`

Run: `npm run test:all`

Run: `node --check app.js && node --check lib/catalog.mjs && node --check lib/view.mjs && node --check scripts/update-awesome-list.mjs`

Run: `git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Verify generated-data invariants**

Run a Node check that asserts 688 current repositories, 29 current languages, every projected repository has exactly the 13 approved keys with final `starred_order`, ordinals are safe and unique, recently-starred sorting restores ascending source order, and serialized `data.json` is smaller than its pre-redesign 918,519-byte baseline.

Expected: all assertions pass.

- [ ] **Step 3: Perform rendered desktop and mobile QA**

Use the Browser plugin when available. Verify page identity, meaningful first paint, no framework/error overlay, no console errors, language filtering, search, sorting, clear filters, `Load more`, keyboard focus, and external-link behavior. Capture screenshots at 1440x900 and 390x844. Check for overlap, clipping, horizontal overflow, broken images, unstable card dimensions, and text escaping.

- [ ] **Step 4: Review changes and repository state**

Run: `git status --short --branch`

Run: `git log --oneline -12`

Run: `git diff HEAD~9 --stat`

Expected: only the intentional redesign commits are present, generated test artifacts are ignored, and the branch contains no unstaged source changes.

- [ ] **Step 5: Use completion workflow**

Invoke `superpowers:requesting-code-review`, address validated findings, rerun verification, then invoke `superpowers:finishing-a-development-branch` to choose push/PR/integration handling. Do not push until the user authorizes that external state change.
