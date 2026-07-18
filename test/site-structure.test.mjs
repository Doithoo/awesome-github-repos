import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const indexPath = new URL('index.html', root);
const ignorePath = new URL('.gitignore', root);
const readmePath = new URL('README.md', root);
const viewPath = new URL('lib/view.mjs', root);
const appPath = new URL('app.js', root);

const readIndex = () => readFile(indexPath, 'utf8');

function attributes(tag) {
  const values = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/gs;
  let match;

  while ((match = pattern.exec(tag)) !== null) {
    values[match[1].toLowerCase()] = match[3];
  }

  return values;
}

function openingTags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function openingTagById(html, id) {
  const tag = openingTags(html, '[a-z][\\w-]*')
    .find((candidate) => attributes(candidate).id === id);

  assert.ok(tag, `missing #${id}`);
  return tag;
}

function elementById(html, id) {
  const openingTag = openingTagById(html, id);
  const name = openingTag.match(/^<([\w-]+)/i)[1];
  const start = html.indexOf(openingTag);
  const remainder = html.slice(start + openingTag.length);
  const closingTag = new RegExp(`</${name}\\s*>`, 'i');
  const end = remainder.search(closingTag);

  assert.notEqual(end, -1, `missing closing tag for #${id}`);
  return { openingTag, body: remainder.slice(0, end), name: name.toLowerCase() };
}

function firstElement(html, name) {
  const match = html.match(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'));

  assert.ok(match, `missing <${name}> element`);
  return { openingTag: `<${name}${match[1]}>`, body: match[2] };
}

function textContent(markup) {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function labelFor(html, id) {
  const labels = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)];
  const label = labels.find((match) => attributes(`<label${match[1]}>`).for === id);

  assert.ok(label, `missing persistent label for #${id}`);
  assert.notEqual(textContent(label[2]), '', `empty label for #${id}`);
  return textContent(label[2]);
}

function linkByHref(html, href) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(`<a\\b(?=[^>]*\\bhref=["']${escapedHref}["'])[^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
  );

  assert.ok(match, `missing link to ${href}`);
  return { openingTag: match[0].slice(0, match[0].indexOf('>') + 1), body: match[1] };
}

test('document declares useful metadata and static assets', async () => {
  const html = await readIndex();
  const htmlTag = openingTags(html, 'html')[0];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const description = openingTags(html, 'meta')
    .map((tag) => attributes(tag))
    .find((attrs) => attrs.name?.toLowerCase() === 'description');
  const links = openingTags(html, 'link').map((tag) => attributes(tag));

  assert.equal(attributes(htmlTag).lang, 'en');
  assert.ok(title && textContent(title[1]), 'missing nonempty title');
  assert.ok(description?.content.trim(), 'missing nonempty meta description');
  assert.ok(
    links.some((attrs) => attrs.rel === 'stylesheet' && attrs.href === 'styles.css'),
    'missing styles.css stylesheet',
  );
  assert.ok(
    links.some((attrs) => attrs.rel === 'icon' && attrs.href === 'assets/favicon.svg'),
    'missing favicon asset',
  );
  assert.equal(existsSync(new URL('assets/favicon.svg', root)), true, 'favicon asset does not exist');
});

test('header navigation carries the exact brand and secure icon-only source link', async () => {
  const html = await readIndex();
  const header = firstElement(html, 'header');
  const primaryNav = openingTags(header.body, 'nav')
    .find((tag) => attributes(tag)['aria-label'] === 'Primary navigation');
  const brand = header.body.match(/<a\b[^>]*\bclass=["'][^"']*\bbrand-link\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const sourceUrl = 'https://github.com/Doithoo/awesome-github-repos';
  const source = linkByHref(header.body, sourceUrl);
  const sourceAttrs = attributes(source.openingTag);

  assert.match(header.openingTag, /^<header\b/i);
  assert.ok(primaryNav, 'missing Primary navigation label');
  assert.equal(textContent(brand?.[1] ?? ''), 'DOITHOO / STARS');
  assert.ok(sourceAttrs.class?.split(/\s+/).includes('source-link'));
  assert.equal(sourceAttrs.href, sourceUrl);
  assert.equal(sourceAttrs.target, '_blank');
  assert.ok(sourceAttrs.rel?.split(/\s+/).includes('noopener'));
  assert.ok(sourceAttrs.rel?.split(/\s+/).includes('noreferrer'));
  assert.ok(sourceAttrs['aria-label']?.trim(), 'source link needs an accessible name');
  const icon = source.body.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  const iconAttrs = attributes(`<svg${icon?.[1] ?? ''}>`);
  const iconPaths = [...(icon?.[2] ?? '').matchAll(/<path\b([^>]*)\/?\s*>/gi)]
    .map((match) => attributes(`<path${match[1]}>`).d);

  assert.ok(icon, 'source link must contain an inline SVG');
  assert.equal(iconAttrs.fill, 'none');
  assert.equal(iconAttrs.stroke, 'currentColor');
  assert.equal(iconAttrs['stroke-linecap'], 'round');
  assert.equal(iconAttrs['stroke-linejoin'], 'round');
  assert.equal(iconAttrs['aria-hidden'], 'true');
  assert.equal(iconPaths.length, 2);
  assert.match(iconPaths[0], /^M15 22v-4/);
  assert.equal(iconPaths[1], 'M9 18c-4.51 2-5-2-7-2');
  assert.equal(
    textContent(source.body.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')),
    '',
    'source link must remain icon-only',
  );
});

test('search panel exposes the collection identity and labeled search control', async () => {
  const html = await readIndex();
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const searchTag = openingTagById(html, 'searchInput');
  const search = attributes(searchTag);

  assert.equal(textContent(heading?.[1] ?? ''), "Doithoo's Starred Repositories");
  openingTagById(html, 'collectionStats');
  assert.match(searchTag, /^<input\b/i);
  assert.equal(search.type, 'search');
  assert.equal(search.autocomplete, 'off');
  assert.equal(search.placeholder, 'Search by name, topic, owner, or language');
  assert.equal(labelFor(html, 'searchInput'), 'Search repositories');
});

test('catalog exposes exact filter controls and options', async () => {
  const html = await readIndex();
  const main = openingTagById(html, 'catalog');
  const toolbar = openingTags(html, 'section').find((tag) => {
    const attrs = attributes(tag);
    return attrs['aria-label'] === 'Repository filters';
  });
  const language = elementById(html, 'languageFilter');
  const languageOptions = [...language.body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
  const sort = elementById(html, 'sortSelect');
  const sortOptions = [...sort.body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({ value: attributes(`<option${match[1]}>`).value, label: textContent(match[2]) }));
  const quickFilters = attributes(openingTagById(html, 'quickFilters'));

  assert.match(main, /^<main\b/i);
  assert.ok(toolbar, 'missing Repository filters section');
  assert.match(toolbar, /^<section\b/i);
  assert.equal(language.name, 'select');
  assert.equal(sort.name, 'select');
  assert.equal(labelFor(html, 'languageFilter'), 'Language');
  assert.equal(labelFor(html, 'sortSelect'), 'Sort');
  assert.equal(attributes(`<option${languageOptions[0]?.[1] ?? ''}>`).value, '');
  assert.equal(textContent(languageOptions[0]?.[2] ?? ''), 'All languages');
  assert.deepEqual(sortOptions, [
    { value: 'recently-starred', label: 'Recently starred' },
    { value: 'stars', label: 'Most stars' },
    { value: 'updated', label: 'Recently updated' },
    { value: 'name', label: 'Name' },
  ]);
  assert.equal(quickFilters['aria-label'], 'Popular languages');
  assert.equal(quickFilters.role, 'group');
});

test('element lookup accepts whitespace before a dynamic closing bracket', () => {
  const element = elementById('<div id="fixture">content</div   >', 'fixture');

  assert.equal(element.body, 'content');
});

test('catalog result regions preserve their semantic and live-region contracts', async () => {
  const html = await readIndex();
  const resultSummary = attributes(openingTagById(html, 'resultSummary'));
  const repositoryGrid = elementById(html, 'repositoryGrid');
  const loadMore = elementById(html, 'loadMoreButton');
  const loadMoreAttrs = attributes(loadMore.openingTag);
  const statusPanel = attributes(openingTagById(html, 'statusPanel'));

  assert.equal(resultSummary['aria-live'], 'polite');
  assert.equal(repositoryGrid.name, 'section');
  assert.equal(attributes(repositoryGrid.openingTag)['aria-label'], 'Repositories');
  assert.equal(loadMore.name, 'button');
  assert.equal(loadMoreAttrs.type, 'button');
  assert.match(loadMore.openingTag, /\shidden(?:\s|>)/i);
  assert.equal(textContent(loadMore.body), 'Load more');
  assert.equal(statusPanel['aria-live'], 'polite');
});

test('footer identifies Doithoo and links to source and Pages securely', async () => {
  const html = await readIndex();
  const footer = elementById(html, 'footer');
  const expectedLinks = [
    ['https://github.com/Doithoo', 'Doithoo'],
    ['https://github.com/Doithoo/awesome-github-repos', 'Source'],
    ['https://doithoo.github.io/awesome-github-repos/', 'Pages'],
  ];

  assert.equal(footer.name, 'footer');
  for (const [href, label] of expectedLinks) {
    const link = linkByHref(footer.body, href);
    assert.equal(textContent(link.body), label);
  }
});

test('page loads the application with the exact module contract', async () => {
  const html = await readIndex();
  const appScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => attributes(`<script${match[1]}>`).src === 'app.js');

  assert.equal(appScripts.length, 1);
  assert.equal(attributes(`<script${appScripts[0][1]}>`).type, 'module');
  assert.equal(textContent(appScripts[0][2]), '');
});

test('application controller imports the catalog and view contracts', async () => {
  const source = await readFile(appPath, 'utf8');

  for (const name of [
    'PAGE_SIZE',
    'filterRepositories',
    'getLanguageCounts',
    'normalizeRepositories',
    'paginateRepositories',
    'sortRepositories',
  ]) {
    assert.match(
      source,
      new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]\\.\\/lib\\/catalog\\.mjs['"]`, 's'),
      `missing catalog import: ${name}`,
    );
  }

  for (const name of [
    'createRepositoryCard',
    'renderLanguageOptions',
    'renderQuickFilters',
    'renderRepositoryGrid',
    'renderSummary',
    'renderLoading',
    'renderError',
    'renderEmpty',
  ]) {
    assert.match(
      source,
      new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]\\.\\/lib\\/view\\.mjs['"]`, 's'),
      `missing view import: ${name}`,
    );
  }

  assert.equal((source.match(/\bclass\s+CatalogApp\b/g) ?? []).length, 1);
  assert.match(source, /export\s+class\s+CatalogApp\b/);
});

test('application controller has stable state, loading policy, and action routes', async () => {
  const source = await readFile(appPath, 'utf8');

  assert.match(
    source,
    /this\.state\s*=\s*\{\s*repositories:\s*\[\],\s*query:\s*['"`]{2},\s*language:\s*['"`]{2},\s*sort:\s*['"]recently-starred['"],\s*visibleCount:\s*PAGE_SIZE,\s*status:\s*['"]loading['"],\s*error:\s*null\s*,?\s*\}/s,
  );
  assert.match(source, /new\s+AbortController\s*\(/);
  assert.match(source, /const\s+LOAD_TIMEOUT_MS\s*=\s*10_?000\s*;/);
  assert.match(source, /setTimeout\s*\([\s\S]*?,\s*LOAD_TIMEOUT_MS\s*\)/);
  assert.match(source, /clearTimeout\s*\(/);
  assert.match(
    source,
    /response\.json\s*\(\s*\)[\s\S]*?catch\s*\(\s*error\s*\)\s*\{[\s\S]*?error\.name\s*===\s*['"]AbortError['"][\s\S]*?throw\s+error\s*;/,
    'JSON parsing must preserve AbortError for timeout handling',
  );
  assert.match(source, /fetch\s*\(\s*['"]data\.json['"]\s*,\s*\{\s*signal\s*:\s*[^,}]+,\s*cache\s*:\s*['"]default['"]\s*,?\s*\}\s*\)/s);
  assert.match(source, /(?:const\s+SEARCH_DEBOUNCE_MS\s*=\s*|setTimeout\s*\([\s\S]*?,\s*)(?:1[5-9]\d|200)\b/);

  for (const message of [
    'The repository list took too long to load.',
    'The repository list could not be downloaded.',
    'The repository data is not valid.',
  ]) {
    assert.ok(source.includes(message), `missing exact error message: ${message}`);
  }

  for (const id of [
    'collectionStats',
    'searchInput',
    'languageFilter',
    'sortSelect',
    'quickFilters',
    'resultSummary',
    'repositoryGrid',
    'loadMoreButton',
    'statusPanel',
  ]) {
    assert.match(source, new RegExp(`['"]${id}['"]`), `controller must cache #${id}`);
  }

  for (const action of ['filter-language', 'retry', 'clear-filters']) {
    assert.match(source, new RegExp(`['"]${action}['"]`), `missing ${action} action route`);
  }

  for (const [element, eventName] of [
    ['searchInput', 'input'],
    ['languageFilter', 'change'],
    ['sortSelect', 'change'],
    ['quickFilters', 'click'],
    ['loadMoreButton', 'click'],
    ['statusPanel', 'click'],
  ]) {
    const listener = new RegExp(`this\\.elements\\.${element}\\.addEventListener\\(\\s*['"]${eventName}['"]`, 'g');
    assert.equal((source.match(listener) ?? []).length, 1, `${element} listener must be bound once`);
  }

  assert.match(
    source,
    /searchInput\.addEventListener\(\s*['"]input['"]\s*,\s*\(event\)\s*=>\s*\{\s*const\s+query\s*=\s*event\.currentTarget\.value\.trim\(\);[\s\S]*?setTimeout\s*\([\s\S]*?this\.state\.query\s*=\s*query;/,
    'search input must be read before currentTarget is cleared',
  );
});

test('application controller excludes legacy and unsafe behavior', async () => {
  const source = await readFile(appPath, 'utf8');
  const forbidden = [
    /\.innerHTML\b/,
    /\binsertAdjacentHTML\b/,
    /\bsetInterval\s*\(/,
    /\bPerformanceObserver\b|\bperformance\s*\./i,
    /\bmemory\b|\bgpu\b|\bparallax\b|virtual\s*scroll/i,
    /\.tabIndex\s*=\s*[1-9]\d*|setAttribute\(\s*['"]tabindex['"]\s*,\s*['"]?[1-9]/i,
    /document\.addEventListener\(\s*['"]keydown['"]|window\.addEventListener\(\s*['"]keydown['"]/,
    /typeof\s+process|window\.process|module\.exports|\brequire\s*\(/,
    /\bIntersectionObserver\b|\bMutationObserver\b/,
    /\banalytics\b|console\.log\s*\(|\btoast\b|\btouch(?:start|move|end)\b/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }

  const methodNames = [...source.matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)]
    .map((match) => match[1]);
  assert.equal(methodNames.length, new Set(methodNames).size, 'duplicate controller method definition');
});

test('active page contains no legacy ownership or unsafe rendering hook', async () => {
  const html = await readIndex();

  assert.match(html, />DOITHOO \/ STARS</);
  assert.match(html, /https:\/\/github\.com\/Doithoo\/awesome-github-repos/);
  assert.doesNotMatch(html, /tonngw/i);
  assert.doesNotMatch(html, /innerHTML/);
  assert.equal(existsSync(new URL('index-simple.html', root)), false);
});

test('stable integration IDs are unique', async () => {
  const html = await readIndex();
  const stableIds = [
    'collectionStats',
    'searchInput',
    'catalog',
    'languageFilter',
    'sortSelect',
    'quickFilters',
    'resultSummary',
    'repositoryGrid',
    'loadMoreButton',
    'statusPanel',
    'footer',
  ];

  for (const id of stableIds) {
    const occurrences = openingTags(html, '[a-z][\\w-]*')
      .filter((tag) => attributes(tag).id === id);
    assert.equal(occurrences.length, 1, `expected exactly one #${id}`);
  }
});

test('README does not reference the deleted alternate shell', async () => {
  const readme = await readFile(readmePath, 'utf8');

  assert.doesNotMatch(readme, /index-simple\.html/i);
});

test('generated local artifacts are ignored with exact root entries', async () => {
  const entries = (await readFile(ignorePath, 'utf8')).split(/\r?\n/);

  for (const entry of ['.superpowers/', '.worktrees/', 'playwright-report/', 'test-results/']) {
    assert.ok(entries.includes(entry), `missing exact .gitignore entry: ${entry}`);
  }
});

test('external static links open securely in a new tab', async () => {
  const html = await readIndex();
  const externalLinks = openingTags(html, 'a')
    .filter((tag) => /^https?:\/\//.test(attributes(tag).href ?? ''));

  assert.ok(externalLinks.length > 0, 'expected at least one external link');
  for (const link of externalLinks) {
    const attrs = attributes(link);
    const rel = attrs.rel?.split(/\s+/) ?? [];

    assert.equal(attrs.target, '_blank', `missing target on ${link}`);
    assert.ok(rel.includes('noopener'), `missing noopener on ${link}`);
    assert.ok(rel.includes('noreferrer'), `missing noreferrer on ${link}`);
  }
});

test('safe DOM view exposes the complete rendering contract', async () => {
  assert.equal(existsSync(viewPath), true, 'missing lib/view.mjs');

  const view = await import(viewPath);
  const expectedExports = [
    'createRepositoryCard',
    'renderLanguageOptions',
    'renderQuickFilters',
    'renderRepositoryGrid',
    'renderSummary',
    'renderLoading',
    'renderError',
    'renderEmpty',
  ];

  assert.deepEqual(Object.keys(view).sort(), expectedExports.sort());
  for (const name of expectedExports) {
    assert.equal(typeof view[name], 'function', `${name} must be a function`);
  }
});

test('safe DOM view enforces URL policy inside link and image sinks', async () => {
  const source = await readFile(viewPath, 'utf8');
  const linkHelper = source.match(/function secureExternalLink\b[\s\S]*?\n}/)?.[0] ?? '';
  const avatarHelper = source.match(/function createAvatar\b[\s\S]*?\n}/)?.[0] ?? '';

  assert.match(
    source,
    /import\s*\{[^}]*\bgetSafeUrl\b[^}]*\}\s*from\s*['"]\.\/catalog\.mjs['"]/s,
  );
  assert.notEqual(linkHelper, '', 'missing secureExternalLink helper');
  assert.match(
    linkHelper,
    /function secureExternalLink\(\s*className\s*,\s*candidateUrl\s*,\s*\{\s*label\s*,\s*githubOnly\s*\}\s*\)/,
  );
  assert.match(
    linkHelper,
    /const\s+url\s*=\s*getSafeUrl\(\s*candidateUrl\s*,\s*\{\s*githubOnly\s*\}\s*\)/,
  );
  assert.match(linkHelper, /if\s*\(\s*!url\s*\)\s*\{[\s\S]*?return null;/);
  assert.match(linkHelper, /attributes\s*:\s*\{\s*href\s*:\s*url\s*\}/);

  assert.notEqual(avatarHelper, '', 'missing createAvatar helper');
  assert.match(
    avatarHelper,
    /const\s+avatarUrl\s*=\s*getSafeUrl\(\s*avatarCandidate\s*\)/,
  );
  assert.match(avatarHelper, /attributes\s*:\s*\{\s*src\s*:\s*avatarUrl\s*,/);
  assert.match(source, /createAvatar\(\s*owner\.avatarUrl\s*,\s*login\s*\)/);

  assert.match(
    source,
    /secureExternalLink\(\s*['"]repository-name['"]\s*,\s*repository\.repositoryUrl\s*,\s*\{\s*label\s*:\s*`View \$\{fullName\} on GitHub`\s*,\s*githubOnly\s*:\s*true\s*,?\s*\}\s*,?\s*\)/,
  );
  assert.match(
    source,
    /secureExternalLink\(\s*['"]repository-owner['"]\s*,\s*owner\.profileUrl\s*,\s*\{\s*label\s*:\s*`View \$\{login\} on GitHub`\s*,\s*githubOnly\s*:\s*true\s*,?\s*\}\s*,?\s*\)/,
  );
  assert.match(
    source,
    /secureExternalLink\(\s*['"]repository-homepage['"]\s*,\s*repository\.homepage\s*,\s*\{\s*label\s*:\s*`Visit the \$\{fullName\} homepage`\s*,\s*githubOnly\s*:\s*false\s*,?\s*\}\s*,?\s*\)/,
  );
  assert.doesNotMatch(
    source,
    /(?:href|src)\s*:\s*(?:repository|owner)\.(?:repositoryUrl|profileUrl|homepage|avatarUrl)/,
  );
  assert.doesNotMatch(
    source,
    /setAttribute\(\s*['"](?:href|src)['"]\s*,\s*(?:repository|owner)\./,
  );
  assert.doesNotMatch(source, /\bsafeHttpsUrl\b/);
});

test('topic links use their visible topic text as the accessible name', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(
    source,
    /secureExternalLink\(\s*['"]repository-topic['"]\s*,\s*`https:\/\/github\.com\/topics\/\$\{encodeURIComponent\(topic\)\}`\s*,\s*\{\s*githubOnly\s*:\s*true\s*,?\s*\}\s*,?\s*\)/,
  );
  assert.match(source, /link\.textContent\s*=\s*topic/);
  assert.doesNotMatch(source, /Browse this topic on GitHub/);
});

test('repository cards expose each repository name as an article heading', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(
    source,
    /const\s+titleHeading\s*=\s*element\(\s*['"]h2['"]\s*,\s*\{\s*className\s*:\s*['"]repository-title['"]\s*\}\s*\)/,
  );
  assert.match(source, /titleHeading\.append\(\s*title\s*\)/);
  assert.match(source, /identity\.append\(\s*titleHeading\s*\)/);
});

test('status renderers rely on the shell live region without nested roles', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.doesNotMatch(
    source,
    /\brole\s*:\s*['"](?:status|alert)['"]|setAttribute\(\s*['"]role['"]\s*,\s*['"](?:status|alert)['"]/,
  );
  assert.doesNotMatch(source, /['"]aria-live['"]/);
});

test('safe DOM view builds trusted structure without HTML string sinks', async () => {
  const source = await readFile(viewPath, 'utf8');

  for (const unsafePattern of [
    /\.innerHTML\b/,
    /\binsertAdjacentHTML\b/,
    /\beval\s*\(/,
    /\bdocument\.write\s*\(/,
    /\bhref\s*=\s*`[^`]*\$\{/,
    /setAttribute\(\s*['"]href['"]\s*,\s*`[^`]*\$\{(?!encodeURIComponent\(topic\))/,
  ]) {
    assert.doesNotMatch(source, unsafePattern);
  }

  assert.match(source, /\.textContent\s*=/);
  assert.match(source, /document\.createElement\(/);
  assert.match(source, /document\.createDocumentFragment\(/);
  assert.match(source, /\.replaceChildren\(/);
  assert.match(
    source,
    /https:\/\/github\.com\/topics\/\$\{encodeURIComponent\(topic\)\}/,
  );
  assert.match(source, /setAttribute\(\s*['"]target['"]\s*,\s*['"]_blank['"]\s*\)/);
  assert.match(
    source,
    /setAttribute\(\s*['"]rel['"]\s*,\s*['"]noopener noreferrer['"]\s*\)/,
  );
  assert.match(source, /setAttribute\(\s*['"]loading['"]\s*,\s*['"]lazy['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]decoding['"]\s*,\s*['"]async['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]width['"]\s*,\s*['"]40['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]height['"]\s*,\s*['"]40['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]data-action['"]\s*,\s*['"]filter-language['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]data-action['"]\s*,\s*['"]retry['"]\s*\)/);
  assert.match(source, /setAttribute\(\s*['"]data-action['"]\s*,\s*['"]clear-filters['"]\s*\)/);
  assert.match(source, /\.slice\(0,\s*3\)/);
});
