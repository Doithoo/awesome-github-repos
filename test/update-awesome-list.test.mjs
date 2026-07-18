import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fileSystem from 'node:fs/promises';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  fetchStarredRepositories,
  groupRepositories,
  projectRepository,
  renderJson,
  renderMarkdown,
  writeOutputs,
} from '../scripts/update-awesome-list.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function response(body, nextLink = null, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(nextLink ? { link: nextLink } : {}),
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function repository(overrides = {}) {
  return {
    id: 1,
    node_id: 'R_1',
    name: 'example',
    full_name: 'owner/example',
    owner: {
      login: 'owner',
      id: 9,
      avatar_url: 'https://avatars.example/owner',
      url: 'https://api.github.com/users/owner',
      html_url: 'https://github.com/owner',
      ignored: 'value',
    },
    html_url: 'https://github.com/owner/example',
    description: 'Example repository',
    url: 'https://api.github.com/repos/owner/example',
    languages_url: 'https://api.github.com/repos/owner/example/languages',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    git_url: 'git://github.com/owner/example.git',
    ssh_url: 'git@github.com:owner/example.git',
    clone_url: 'https://github.com/owner/example.git',
    homepage: null,
    stargazers_count: 10,
    watchers_count: 10,
    language: 'JavaScript',
    topics: ['example'],
    private: false,
    forks_count: 20,
    ...overrides,
  };
}

test('fetches every starred repository page in response order', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const page = new URL(url).searchParams.get('page');
    return page === '2'
      ? response([repository({ id: 2 })])
      : response(
        [repository({ id: 1 })],
        '<https://api.github.com/user/starred?per_page=100&page=2>; rel="next"',
      );
  };

  const repositories = await fetchStarredRepositories('test-token', fetchImpl);

  assert.deepEqual(repositories.map(({ id }) => id), [1, 2]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(requests[0].options.headers.Accept, 'application/vnd.github+json');
  assert.equal(requests[0].options.headers['X-GitHub-Api-Version'], '2022-11-28');
});

test('reports GitHub API failures with status and response details', async () => {
  const fetchImpl = async () => response('rate limit exceeded', null, 403);

  await assert.rejects(
    fetchStarredRepositories('test-token', fetchImpl),
    /GitHub API request failed \(403\): rate limit exceeded/,
  );
});

test('rejects unexpected GitHub API response bodies', async () => {
  const fetchImpl = async () => response({ message: 'not an array' });

  await assert.rejects(
    fetchStarredRepositories('test-token', fetchImpl),
    /expected an array/,
  );
});

test('rejects malformed next-page links instead of truncating results', async () => {
  const fetchImpl = async () => response(
    [repository()],
    'not-a-valid-link; rel="next"',
  );

  await assert.rejects(
    fetchStarredRepositories('test-token', fetchImpl),
    /GitHub API pagination link is invalid/,
  );
});

test('projects repositories to the reduced browser data contract', () => {
  const projected = projectRepository(repository({
    description: null,
    homepage: null,
    language: null,
    topics: [],
  }));

  assert.deepEqual(Object.keys(projected), [
    'id', 'name', 'full_name', 'owner', 'html_url', 'description', 'homepage',
    'stargazers_count', 'language', 'topics', 'created_at', 'updated_at',
  ]);
  assert.deepEqual(Object.keys(projected.owner), [
    'login', 'avatar_url', 'html_url',
  ]);
  for (const field of [
    'node_id', 'url', 'languages_url', 'git_url', 'ssh_url', 'clone_url',
    'watchers_count', 'private', 'forks_count',
  ]) {
    assert.equal(field in projected, false, `${field} should be omitted`);
  }
  for (const field of ['id', 'url', 'ignored']) {
    assert.equal(field in projected.owner, false, `owner.${field} should be omitted`);
  }
  assert.equal(projected.description, null);
  assert.equal(projected.homepage, null);
  assert.equal(projected.language, null);
  assert.deepEqual(projected.topics, []);
});

test('groups repositories by first-seen language and uses miscellaneous', () => {
  const grouped = groupRepositories([
    repository({ id: 1, language: 'JavaScript' }),
    repository({ id: 2, language: null }),
    repository({ id: 3, language: 'JavaScript' }),
  ]);

  assert.deepEqual(Object.keys(grouped), ['JavaScript', 'miscellaneous']);
  assert.deepEqual(grouped.JavaScript.map(({ id }) => id), [1, 3]);
  assert.deepEqual(grouped.miscellaneous.map(({ id }) => id), [2]);
});

test('renders deterministic two-space JSON with a trailing newline', () => {
  const grouped = {
    JavaScript: [projectRepository(repository())],
  };

  const json = renderJson(grouped);

  assert.equal(json, `${JSON.stringify(grouped, null, 2)}\n`);
});

test('renders compatible Markdown headings and duplicate GitHub slugs', () => {
  const grouped = groupRepositories([
    repository({ id: 1, language: 'JavaScript' }),
    repository({ id: 2, language: 'C++', full_name: 'owner/cpp' }),
    repository({ id: 3, language: 'C', full_name: 'owner/c' }),
    repository({ id: 4, language: 'C#', full_name: 'owner/csharp' }),
    repository({
      id: 5,
      language: null,
      full_name: 'owner/no_language',
      description: '[Docs] Q&A :black_flag:',
    }),
    repository({ id: 6, language: null, full_name: 'owner/no-description', description: null }),
  ]);

  const markdown = renderMarkdown(grouped);
  const [header] = markdown.split('\n');

  assert.equal(
    header,
    '# [![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/Doithoo) [![Awesome](https://badgen.net/static/GitHub/Repos/blue)](https://github.com/Doithoo)',
  );
  assert.equal((header.match(/https:\/\/github\.com\/Doithoo/g) ?? []).length, 2);
  assert.doesNotMatch(header, /tonngw/);
  assert.match(markdown, /\* \[JavaScript\]\(#javascript\)/);
  assert.match(markdown, /\* \[C\+\+\]\(#c\)/);
  assert.match(markdown, /\* \[C\]\(#c-1\)/);
  assert.match(markdown, /\* \[C#\]\(#c-2\)/);
  assert.match(markdown, /\* \[miscellaneous\]\(#miscellaneous\)/);
  assert.match(markdown, /## C\+\+/);
  assert.match(markdown, /## C\\#/);
  assert.equal(
    markdown.includes(
      '* [owner/no\\_language](https://github.com/owner/example) - \\[Docs] Q\\&A :black\\_flag:',
    ),
    true,
  );
  assert.match(markdown, /\* \[owner\/no-description\].* -\n/);
  assert.doesNotMatch(markdown, /null/);
  assert.equal(markdown.endsWith('\n'), true);
});

test('writes complete outputs and removes temporary files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'awesome-list-'));
  const grouped = {
    JavaScript: [projectRepository(repository())],
  };

  try {
    await writeOutputs(grouped, directory);

    assert.equal(
      await readFile(path.join(directory, 'data.json'), 'utf8'),
      renderJson(grouped),
    );
    assert.equal(
      await readFile(path.join(directory, 'data.md'), 'utf8'),
      renderMarkdown(grouped),
    );
    assert.deepEqual((await readdir(directory)).sort(), ['data.json', 'data.md']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('restores both previous outputs when replacement fails', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'awesome-list-'));
  const jsonPath = path.join(directory, 'data.json');
  const markdownPath = path.join(directory, 'data.md');
  let rejectedMarkdownReplacement = false;
  const operations = {
    ...fileSystem,
    async rename(source, destination) {
      if (
        !rejectedMarkdownReplacement
        && source.includes('.data.md.')
        && source.endsWith('.tmp')
      ) {
        rejectedMarkdownReplacement = true;
        throw new Error('simulated replacement failure');
      }
      return fileSystem.rename(source, destination);
    },
  };

  try {
    await writeFile(jsonPath, 'old json\n');
    await writeFile(markdownPath, 'old markdown\n');

    await assert.rejects(
      writeOutputs(
        { JavaScript: [projectRepository(repository())] },
        directory,
        operations,
      ),
      /simulated replacement failure/,
    );

    assert.equal(await readFile(jsonPath, 'utf8'), 'old json\n');
    assert.equal(await readFile(markdownPath, 'utf8'), 'old markdown\n');
    assert.deepEqual((await readdir(directory)).sort(), ['data.json', 'data.md']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI rejects a missing API_TOKEN before making requests', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/update-awesome-list.mjs'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, API_TOKEN: '' },
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /API_TOKEN is required/);
});
