# Comprehensive Repository Redesign

## Purpose

Replace the current monolithic frontend with a secure, maintainable, and fast static application for browsing Doithoo's starred GitHub repositories. Keep the repository deployable directly to GitHub Pages without a build step.

## Goals

- Replace the existing UI with the approved Search Gallery layout and Graphic Signal visual language.
- Fix language filtering and eliminate duplicate, overridden frontend methods.
- Treat all GitHub API data as untrusted input.
- Render large result sets incrementally without unnecessary DOM churn.
- Make filtering, sorting, loading, failure, and empty states testable.
- Keep the update generator dependency-free and preserve atomic output replacement.
- Align repository metadata, documentation, generated Markdown, and site links with Doithoo.

## Non-Goals

- Add a JavaScript framework or build pipeline.
- Add authentication, server-side storage, analytics, or user accounts.
- Add a dark theme.
- Preserve `index-simple.html` as an alternate interface.
- Preserve undocumented frontend implementation details from the current `GitHubShowcase` class.

## Visual Direction

The approved direction is **Search Gallery / Graphic Signal**:

- A cool white background with graphite text.
- Cobalt blue as the primary action and focus color.
- Signal red for small highlights and status emphasis.
- Restrained neutral borders and shadows rather than decorative gradients.
- Compact navigation, a prominent search surface, and a two-column repository grid on desktop.
- A single-column grid on mobile.
- Cards use no more than an 8px corner radius and remain stable as content changes.
- Motion is brief and functional, and is disabled when `prefers-reduced-motion` is enabled.

The interface language is English. The README provides clear Chinese and English guidance.

## Information Architecture

The page contains these bands in order:

1. Compact navigation with `DOITHOO / STARS` and a GitHub repository link.
2. Search header with the literal title `Doithoo's Starred Repositories`, supporting repository statistics, and the primary search input.
3. Filter toolbar containing language, sort order, and common-language quick filters.
4. Result summary and repository card grid.
5. Explicit `Load more` control when additional results exist.
6. Compact footer with ownership and source links.

The previous language-section layout is removed. Results are a flat collection so search and sorting behavior remain predictable.

## Frontend Architecture

The site remains a native JavaScript application loaded as ES modules:

- `index.html` contains the semantic shell and static controls.
- `app.js` is the controller and application entry point. It owns data loading, state transitions, event binding, and render scheduling.
- `lib/catalog.mjs` contains DOM-independent data validation, normalization, search, filtering, sorting, language statistics, pagination, date formatting, and URL validation.
- `lib/view.mjs` creates and updates DOM elements for cards, filters, statistics, and application states.
- `styles.css` implements the Graphic Signal design system and responsive behavior.

Application state has this shape:

```js
{
  repositories: [],
  query: '',
  language: '',
  sort: 'recently-starred',
  visibleCount: 24,
  status: 'loading',
  error: null
}
```

Derived results are computed from the immutable normalized repository collection. Changing query, language, or sort resets `visibleCount` to 24. `Load more` increments it by 24.

## Browser Data Contract

`data.json` retains only fields used by the site or generated Markdown:

```text
id
name
full_name
owner.login
owner.avatar_url
owner.html_url
html_url
description
homepage
stargazers_count
language
topics
created_at
updated_at
starred_order
```

The generator continues grouping repositories by first-seen language for stable output compatibility. Each public repository carries its original zero-based API position in `starred_order`; skipped non-public entries may leave gaps. The frontend flattens the groups and restores that ordinal as the `recently-starred` order, with flatten order retained only as compatibility fallback for older data and array fixtures.

The generator removes unused API and clone fields: `node_id`, API URLs, Git/SSH/clone URLs, owner ID, and watcher count.

## Search, Filter, And Sort

Search is case-insensitive and token-based. Every whitespace-delimited query token must occur in at least one searchable field: repository name, full name, description, language, owner login, or topics.

Language filtering performs an exact match. The select control and quick-language buttons update the same state field.

Supported sorting modes are:

- Recently starred, using source order.
- Most stars.
- Recently updated.
- Name A-Z.

Sorting is stable, with source order as the final tie-breaker.

## Safe Rendering

GitHub API content is untrusted:

- Text is assigned with `textContent`, never interpolated into `innerHTML`.
- Repository and owner links must be valid `https:` URLs on `github.com`.
- Avatar URLs must be valid `https:` URLs.
- Homepage links may use any host but must use `https:`.
- Invalid links are omitted or replaced with non-interactive text.
- Topic URLs are constructed from encoded topic names, not copied from API data.
- External links use `target="_blank"` and `rel="noopener noreferrer"`.

The obsolete `index-simple.html`, which directly interpolates API fields into HTML, is deleted.

## Loading And Error Handling

The initial `data.json` request uses an `AbortController` with a 10-second timeout. The controller distinguishes:

- Timeout or network failure.
- Non-success HTTP response.
- Invalid JSON or invalid top-level schema.
- A valid but empty repository collection.

Loading displays stable skeleton cards. A recoverable failure displays a concise message and retry button. An empty filtered result displays a clear-filters action. Retrying does not duplicate event listeners.

## Performance

- Render at most 24 repository cards initially.
- Append the next 24 cards only through `Load more`.
- Rebuild the current result grid only when query, language, or sort changes.
- Debounce text search by 150-200 ms.
- Use native image lazy loading with explicit avatar dimensions.
- Avoid custom virtual scrolling, parallax, GPU forcing, memory polling, and performance observers.
- Keep event listeners centralized; use event delegation for repeated card and quick-filter elements where appropriate.
- Reduce `data.json` by removing unused fields.

## Accessibility

- Use semantic header, navigation, main, section, article, and footer elements.
- Every form control has a persistent label or accessible name.
- Focus order remains native; no positive `tabindex` values are assigned.
- Visible focus indicators use the cobalt accent with sufficient contrast.
- Result counts are announced through one polite live region.
- `Load more`, retry, and clear-filter controls are keyboard accessible.
- No application shortcut overrides browser refresh or other standard shortcuts.
- Motion honors `prefers-reduced-motion`.

## Workflow And Repository Maintenance

- The update workflow runs unit tests before generating and committing data.
- The Pages workflow deploys after a successful update workflow or a direct push to `main`; failed update runs cannot trigger deployment.
- Workflow permissions remain least-privilege.
- Action references are hardened to immutable commit SHAs where maintainable, with Dependabot configured for updates.
- `package.json`, README links, page links, generated Markdown badges, and repository ownership reference Doithoo.
- README token guidance requests only the access required to read the authenticated user's starred repositories.
- Broken Documentation and missing Contributing links are removed unless corresponding files are added.
- The blocked `mawesome` action is documented only as historical context, not as an active dependency.

## Testing Strategy

### Unit Tests

Node tests cover:

- Grouped and array input normalization.
- Invalid data rejection.
- Token-based search across every supported field.
- Exact language filtering.
- Every sort mode and stable tie-breaking.
- Pagination boundaries and reset behavior.
- URL policy for GitHub, avatar, homepage, and invalid schemes.
- Date and number formatting edge cases.

### Generator Tests

Existing coverage is retained and updated for the reduced data contract. Tests continue covering pagination, API failures, malformed responses, Markdown rendering, temporary-file cleanup, rollback, and missing credentials.

### Browser Tests

A lightweight Playwright suite covers:

- Successful initial load and meaningful content.
- Language selection filtering only the selected language.
- Search, sort, clear, retry, and `Load more` behavior.
- No unsafe homepage link rendering.
- No relevant console errors.
- Desktop and mobile viewport smoke checks.

Browser dependencies are development-only and locked for reproducible CI installation.

## Acceptance Criteria

- The approved Graphic Signal UI is usable at desktop and mobile widths without overlap or horizontal scrolling.
- Language filtering updates state and shows only exact language matches.
- Search, all sort modes, quick filters, clear filters, retry, and `Load more` work through keyboard and pointer input.
- No API-provided text is written through `innerHTML`, and unsafe URLs are not rendered as links.
- The initial result DOM contains no more than 24 repository cards.
- `index-simple.html` is removed.
- The frontend contains no duplicate method definitions or dead virtual-scrolling/performance-monitoring code.
- Unit, generator, workflow, and browser tests pass in CI.
- Failed update runs do not deploy Pages.
- All active ownership and site links resolve to Doithoo's repository or Pages site.
