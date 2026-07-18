import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

test('update workflow uses the tested local generator', async () => {
  const workflow = await readFile(
    path.join(projectRoot, '.github/workflows/main.yml'),
    'utf8',
  );

  assert.doesNotMatch(workflow, /simonecorsi\/mawesome/);
  assert.match(workflow, /uses: actions\/checkout@v4/);
  assert.match(workflow, /uses: actions\/setup-node@v4/);
  assert.match(workflow, /node-version: ['"]22['"]/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run update-awesome-list/);
  assert.match(workflow, /API_TOKEN: \$\{\{ secrets\.API_TOKEN \}\}/);
  assert.match(workflow, /git add data\.json data\.md/);
});
