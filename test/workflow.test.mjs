import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const officialActions = {
  Checkout: 'actions/checkout@v4',
  'Set up Node.js': 'actions/setup-node@v4',
  'Setup Pages': 'actions/configure-pages@v5',
  'Upload artifact': 'actions/upload-pages-artifact@v3',
  'Deploy to GitHub Pages': 'actions/deploy-pages@v4',
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indentedBlock(source, marker) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => marker.test(line));
  assert.notEqual(start, -1, `missing YAML block matching ${marker}`);

  const indentation = lines[start].match(/^\s*/)[0].length;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() && line.match(/^\s*/)[0].length <= indentation) break;
    end += 1;
  }
  return lines.slice(start, end).join('\n');
}

function topLevelBlock(source, name) {
  return indentedBlock(source, new RegExp(`^${escapeRegExp(name)}:(?: .*)?$`));
}

function jobBlock(source, name) {
  return indentedBlock(source, new RegExp(`^  ${escapeRegExp(name)}:$`));
}

function namedStep(source, name) {
  return indentedBlock(
    source,
    new RegExp(`^      - name: ${escapeRegExp(name)}$`),
  );
}

function scalar(block, key) {
  const match = block.match(new RegExp(`^\\s+${escapeRegExp(key)}: (.+)$`, 'm'));
  assert.ok(match, `missing ${key} in:\n${block}`);
  const value = match[1].trim();
  const isQuoted =
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'));
  return isQuoted ? value.slice(1, -1) : value;
}

function assertAction(step, name) {
  assert.equal(scalar(step, 'uses'), officialActions[name]);
}

function assertCommandsInOrder(source, commands) {
  let previous = -1;
  for (const command of commands) {
    const current = source.indexOf(`run: ${command}`);
    assert.ok(current > previous, `${command} must appear in the required order`);
    previous = current;
  }
}

test('update workflow installs dependencies and validates the UI before generation', async () => {
  const workflow = await readFile(
    path.join(projectRoot, '.github/workflows/main.yml'),
    'utf8',
  );
  const build = jobBlock(workflow, 'build');

  assert.equal(topLevelBlock(workflow, 'permissions').trim(), 'permissions: {}');
  assert.match(build, /^    permissions:\n      contents: write$/m);
  assert.match(build, /^    timeout-minutes: 15$/m);
  assertAction(namedStep(workflow, 'Checkout'), 'Checkout');
  const setupNode = namedStep(workflow, 'Set up Node.js');
  assertAction(setupNode, 'Set up Node.js');
  assert.equal(scalar(setupNode, 'node-version'), '22');

  assertCommandsInOrder(build, [
    'npm ci',
    'npx playwright install --with-deps chromium',
    'npm run test:all',
    'npm run update-awesome-list',
  ]);

  const generate = namedStep(workflow, 'Generate awesome list');
  assert.match(generate, /^        env:\n          API_TOKEN: \$\{\{ secrets\.API_TOKEN \}\}$/m);
  assert.equal((workflow.match(/API_TOKEN:/g) ?? []).length, 1);
  assert.doesNotMatch(workflow, /simonecorsi\/mawesome/);
});

test('update workflow preserves scheduling, concurrency, and generated commit semantics', async () => {
  const workflow = await readFile(
    path.join(projectRoot, '.github/workflows/main.yml'),
    'utf8',
  );
  const triggers = topLevelBlock(workflow, 'on');
  const concurrency = topLevelBlock(workflow, 'concurrency');
  const commit = namedStep(workflow, 'Commit generated files');

  assert.match(triggers, /^  workflow_dispatch:$/m);
  assert.match(triggers, /^  schedule:\n    - cron: '00 00 \*\/1 \* \*'$/m);
  assert.match(concurrency, /^  group: update-awesome-list$/m);
  assert.match(concurrency, /^  cancel-in-progress: false$/m);
  assert.match(commit, /git config user\.name "github-actions\[bot\]"/);
  assert.match(commit, /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/);
  assert.match(commit, /^          git add data\.json data\.md$/m);
  assert.match(commit, /if git diff --cached --quiet; then/);
  assert.match(commit, /git commit -m "chore\(updates\): update starred repositories"/);
  assert.match(commit, /^          git push$/m);
});

test('Pages workflow gates every deployment on a successful UI test job', async () => {
  const workflow = await readFile(
    path.join(projectRoot, '.github/workflows/static.yml'),
    'utf8',
  );
  const triggers = topLevelBlock(workflow, 'on');
  const testJob = jobBlock(workflow, 'test');
  const deploy = jobBlock(workflow, 'deploy');
  const successCondition =
    "github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'";

  assert.match(triggers, /^  workflow_run:\n(?:.*\n)*?    workflows: \["Update awesome list"\]\n(?:.*\n)*?    types:\n      - completed$/m);
  assert.match(triggers, /^  push:\n    branches: \["main"\]$/m);
  assert.match(triggers, /^  workflow_dispatch:$/m);

  assert.equal(scalar(testJob, 'if'), successCondition);
  assert.match(testJob, /^    permissions:\n      contents: read$/m);
  assertAction(namedStep(testJob, 'Checkout'), 'Checkout');
  const setupNode = namedStep(testJob, 'Set up Node.js');
  assertAction(setupNode, 'Set up Node.js');
  assert.equal(scalar(setupNode, 'node-version'), '22');
  assertCommandsInOrder(testJob, [
    'npm ci',
    'npx playwright install --with-deps chromium',
    'npm run test:all',
  ]);

  assert.equal(scalar(deploy, 'if'), successCondition);
  assert.equal(scalar(deploy, 'needs'), 'test');
  assert.match(
    deploy,
    /^    permissions:\n      contents: read\n      pages: write\n      id-token: write$/m,
  );
});

test('Pages workflow deploys the checked-out current revision with least privilege', async () => {
  const workflow = await readFile(
    path.join(projectRoot, '.github/workflows/static.yml'),
    'utf8',
  );
  const deploy = jobBlock(workflow, 'deploy');
  const concurrency = topLevelBlock(workflow, 'concurrency');

  assert.equal(topLevelBlock(workflow, 'permissions').trim(), 'permissions: {}');
  assertAction(namedStep(deploy, 'Checkout'), 'Checkout');
  assertAction(namedStep(deploy, 'Setup Pages'), 'Setup Pages');
  const upload = namedStep(deploy, 'Upload artifact');
  assertAction(upload, 'Upload artifact');
  assert.equal(scalar(upload, 'path'), '.');
  assertAction(namedStep(deploy, 'Deploy to GitHub Pages'), 'Deploy to GitHub Pages');
  assert.match(concurrency, /^  group: "pages"$/m);
  assert.match(concurrency, /^  cancel-in-progress: false$/m);
});

test('Dependabot checks npm and GitHub Actions weekly with bounded pull requests', async () => {
  const dependabot = await readFile(
    path.join(projectRoot, '.github/dependabot.yml'),
    'utf8',
  );

  assert.match(dependabot, /^version: 2$/m);
  for (const ecosystem of ['npm', 'github-actions']) {
    const entry = indentedBlock(
      dependabot,
      new RegExp(`^  - package-ecosystem: "${ecosystem}"$`),
    );
    assert.match(entry, /^    directory: "\/"$/m);
    assert.match(entry, /^    schedule:\n      interval: "weekly"$/m);
    assert.match(entry, /^    open-pull-requests-limit: 5$/m);
  }
});
