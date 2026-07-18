import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const indexPath = new URL('index.html', root);
const ignorePath = new URL('.gitignore', root);

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
  const closingTag = new RegExp(`<\/${name}\s*>`, 'i');
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
  assert.match(source.body, /<svg\b[^>]*>[\s\S]*?<\/svg>/i);
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

test('active page contains no legacy ownership or unsafe rendering hook', async () => {
  const html = await readIndex();

  assert.match(html, />DOITHOO \/ STARS</);
  assert.match(html, /https:\/\/github\.com\/Doithoo\/awesome-github-repos/);
  assert.doesNotMatch(html, /tonngw/i);
  assert.doesNotMatch(html, /innerHTML/);
  assert.equal(existsSync(new URL('index-simple.html', root)), false);
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
