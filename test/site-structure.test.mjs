import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const indexPath = new URL('index.html', root);
const ignorePath = new URL('.gitignore', root);

const readIndex = () => readFile(indexPath, 'utf8');

test('page exposes the semantic catalog structure', async () => {
  const html = await readIndex();

  assert.match(html, /<main\b[^>]*\bid=["']catalog["'][^>]*>/i);

  for (const id of [
    'searchInput',
    'languageFilter',
    'sortSelect',
    'quickFilters',
    'repositoryGrid',
    'resultSummary',
    'loadMoreButton',
    'statusPanel',
    'footer',
  ]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`, 'i'), `missing #${id}`);
  }
});

test('page loads the application as a module', async () => {
  const html = await readIndex();

  assert.match(html, /<script\s+type=["']module["']\s+src=["']app\.js["']\s*><\/script>/i);
});

test('active page contains no legacy ownership or unsafe rendering hook', async () => {
  const html = await readIndex();

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
  const externalLinks = html.match(/<a\b[^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*>/gi) ?? [];

  assert.ok(externalLinks.length > 0, 'expected at least one external link');
  for (const link of externalLinks) {
    assert.match(link, /\btarget=["']_blank["']/i, `missing target on ${link}`);
    assert.match(
      link,
      /\brel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/i,
      `missing secure rel on ${link}`,
    );
  }
});

test('controls and the icon-only source link have accessible names', async () => {
  const html = await readIndex();

  for (const id of ['searchInput', 'languageFilter', 'sortSelect']) {
    assert.match(
      html,
      new RegExp(`<label\\b[^>]*\\bfor=["']${id}["'][^>]*>[^<]+<\\/label>`, 'i'),
      `missing persistent label for #${id}`,
    );
  }

  assert.match(
    html,
    /<a\b(?=[^>]*\bclass=["'][^"']*source-link[^"']*["'])(?=[^>]*\baria-label=["'][^"']+["'])[^>]*>/i,
  );
});
