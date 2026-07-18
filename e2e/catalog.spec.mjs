import { expect, test } from '@playwright/test';

const DOWNLOAD_ERROR = 'The repository list could not be downloaded.';

function repository(index, overrides = {}) {
  const language = index % 10 === 0 ? 'Rust' : index % 3 === 0 ? 'TypeScript' : 'JavaScript';
  return {
    id: index + 1,
    name: `project-${String(index + 1).padStart(2, '0')}`,
    full_name: `fixture/project-${String(index + 1).padStart(2, '0')}`,
    owner: {
      login: 'fixture',
      avatar_url: 'https://github.com/fixture.png',
      html_url: 'https://github.com/fixture',
    },
    html_url: `https://github.com/fixture/project-${index + 1}`,
    description: `Fixture repository ${index + 1}`,
    homepage: `https://example.com/project-${index + 1}`,
    stargazers_count: (index * 37) % 997,
    language,
    topics: ['fixture'],
    created_at: new Date(Date.UTC(2020, 0, index + 1)).toISOString(),
    updated_at: new Date(Date.UTC(2024, index % 12, (index % 27) + 1)).toISOString(),
    ...overrides,
  };
}

function fixture(count = 50) {
  return { Fixture: Array.from({ length: count }, (_, index) => repository(index)) };
}

async function mockData(page, data) {
  await page.route('**/data.json', (route) => route.fulfill({ json: data }));
}

function captureConsole(page) {
  const messages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
  return messages;
}

async function expectConsoleHealthy(messages) {
  expect(messages, `unexpected browser console messages:\n${messages.join('\n')}`).toEqual([]);
}

async function repositoryNames(page) {
  return page.locator('.repository-name').allTextContents();
}

test('loads a meaningful catalog without an overlay or console errors', async ({ page }) => {
  const messages = captureConsole(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Doithoo's Starred Repositories/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Doithoo's Starred Repositories");
  await expect(page.locator('.repository-card')).toHaveCount(24);
  await expect(page.locator('#collectionStats')).toHaveText(/\d+ repositories across \d+ languages/);
  await expect(page.locator('#resultSummary')).toHaveText(/Showing 24 of \d+ repositories\./);
  await expect(page.locator('nextjs-portal, vite-error-overlay, #webpack-dev-server-client-overlay')).toHaveCount(0);
  await expect(page.locator('.load-more')).toBeVisible();
  await expectConsoleHealthy(messages);
});

test('language selection filters exactly and updates the summary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);

  await page.locator('#languageFilter').selectOption('JavaScript');
  const languages = page.locator('.repository-language');
  await expect(languages.first()).toHaveText('JavaScript');
  expect(await languages.count()).toBeGreaterThan(0);
  expect(await languages.evaluateAll((nodes) => nodes.filter((node) => node.textContent !== 'JavaScript').length)).toBe(0);
  await expect(page.locator('#resultSummary')).toHaveText(/Showing \d+ of \d+ matches \(\d+ total\)\./);
});

test('search finds a current repository, handles no matches, and clears to 24', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);
  const knownRepository = await page.locator('.repository-name').first().textContent();

  await page.locator('#searchInput').fill(knownRepository);
  await expect(page.locator('.repository-card').first()).toBeVisible();
  expect(await page.locator('.repository-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.repository-name').first()).toContainText(knownRepository);

  await page.locator('#searchInput').fill('__catalog_no_match__');
  await expect(page.locator('.repository-card')).toHaveCount(0);
  await expect(page.getByText('No repositories match your filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('.repository-card')).toHaveCount(24);
});

test('sort controls order by stars, name, and update time', async ({ page }) => {
  const data = fixture(30);
  await mockData(page, data);
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);

  await page.locator('#sortSelect').selectOption('stars');
  const stars = await page.locator('.repository-stars').allTextContents();
  const starValues = stars.map((value) => Number(value.match(/[\d,]+/)[0].replaceAll(',', '')));
  expect(starValues).toEqual([...starValues].sort((left, right) => right - left));

  await page.locator('#sortSelect').selectOption('name');
  const names = await repositoryNames(page);
  expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));

  await page.locator('#sortSelect').selectOption('updated');
  const expected = Object.values(data).flat()
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, 24)
    .map((item) => item.full_name);
  expect(await repositoryNames(page)).toEqual(expected);
});

test('load more appends in place and disappears when a filtered result is exhausted', async ({ page }) => {
  await mockData(page, fixture(50));
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);
  const firstPage = await repositoryNames(page);
  await expect(page.locator('.load-more')).toBeVisible();

  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.repository-card')).toHaveCount(48);
  expect((await repositoryNames(page)).slice(0, 24)).toEqual(firstPage);

  await page.locator('#languageFilter').selectOption('Rust');
  await expect(page.locator('.repository-card')).toHaveCount(5);
  await expect(page.locator('.load-more')).toBeHidden();
});

test('loading skeleton geometry is stable and the load-more band stays absent', async ({ page }) => {
  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  await page.route('**/data.json', async (route) => {
    await responseGate;
    await route.fulfill({ json: fixture(30) });
  });
  await page.goto('/');

  await expect(page.getByText('Loading repositories...')).toBeVisible();
  await expect(page.locator('.repository-card-skeleton')).toHaveCount(6);
  await expect(page.locator('.load-more')).toBeHidden();
  const loadingTop = (await page.locator('.loading-skeleton-grid').boundingBox()).y;
  const columns = await page.locator('.loading-skeleton-grid').evaluate((node) => (
    getComputedStyle(node).gridTemplateColumns.split(' ').length
  ));
  expect(columns).toBe(page.viewportSize().width > 760 ? 2 : 1);

  releaseResponse();
  await expect(page.locator('.repository-card')).toHaveCount(24);
  const loadedTop = (await page.locator('#repositoryGrid').boundingBox()).y;
  expect(Math.abs(loadedTop - loadingTop)).toBeLessThan(80);
});

test('a download error retries successfully with the exact message', async ({ page }) => {
  let requests = 0;
  await page.route('**/data.json', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 500, body: 'server error' });
      return;
    }
    await route.fulfill({ json: fixture(30) });
  });
  await page.goto('/');

  await expect(page.getByText(DOWNLOAD_ERROR, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.repository-card')).toHaveCount(24);
  await expect(page.getByText(DOWNLOAD_ERROR, { exact: true })).toHaveCount(0);
  expect(requests).toBe(2);
});

test('unsafe URLs and HTML-like content remain inert', async ({ page }) => {
  const messages = captureConsole(page);
  await mockData(page, [{
    id: 1,
    name: '<img src=x onerror=alert(1)>',
    full_name: 'unsafe/<script>alert(1)</script>',
    owner: {
      login: '<b>owner</b>',
      avatar_url: 'http://example.com/avatar.png',
      html_url: 'javascript:alert(1)',
    },
    html_url: 'javascript:alert(1)',
    description: '<img src=x onerror=alert(1)> description',
    homepage: 'http://example.com',
    stargazers_count: 1,
    language: 'JavaScript',
    topics: ['<svg onload=alert(1)>'],
    updated_at: '2024-01-01T00:00:00Z',
  }]);
  await page.goto('/');

  await expect(page.locator('.repository-card')).toHaveCount(1);
  await expect(page.locator('.repository-name')).toHaveText('unsafe/<script>alert(1)</script>');
  await expect(page.locator('.repository-description')).toHaveText('<img src=x onerror=alert(1)> description');
  await expect(page.locator('.repository-card script')).toHaveCount(0);
  await expect(page.locator('.repository-homepage, .repository-owner-avatar')).toHaveCount(0);
  const unsafeAttributes = await page.locator('.repository-card').evaluate((card) => (
    [...card.querySelectorAll('[href], [src]')]
      .map((node) => node.getAttribute('href') ?? node.getAttribute('src'))
      .filter((value) => /^(?:javascript:|http:)/i.test(value))
  ));
  expect(unsafeAttributes).toEqual([]);
  await expectConsoleHealthy(messages);
});

test('keyboard activation preserves focus on the replacement quick filter', async ({ page }) => {
  await mockData(page, fixture(50));
  await page.goto('/');
  const quickFilter = page.locator('.quick-filter[data-language="JavaScript"]');
  await quickFilter.focus();
  await quickFilter.press('Enter');

  await expect(quickFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.repository-language').first()).toHaveText('JavaScript');
  expect(await page.evaluate(() => ({
    language: document.activeElement?.dataset.language,
    pressed: document.activeElement?.getAttribute('aria-pressed'),
  }))).toEqual({ language: 'JavaScript', pressed: 'true' });
});

test('responsive boundaries avoid overflow and preserve toolbar behavior', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);

  const assertNoOverflow = async () => {
    const geometry = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      meaningfulFirstViewport: document.querySelector('h1').getBoundingClientRect().top < innerHeight
        && document.querySelector('#searchInput').getBoundingClientRect().top < innerHeight,
      escapedControls: [...document.querySelectorAll('button, input, select')].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
      }).length,
    }));
    expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.meaningfulFirstViewport).toBe(true);
    expect(geometry.escapedControls).toBe(0);
  };
  await assertNoOverflow();

  await page.setViewportSize({ width: 761, height: 900 });
  const desktopToolbar = await page.locator('.toolbar').evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { position: style.position, top: style.top, height: rect.height };
  });
  expect(desktopToolbar.position).toBe('sticky');
  expect(desktopToolbar.top).toBe('0px');
  expect(desktopToolbar.height).toBeLessThan(405);
  await assertNoOverflow();

  await page.setViewportSize({ width: 760, height: 900 });
  const mobilePosition = await page.locator('.toolbar').evaluate((node) => getComputedStyle(node).position);
  expect(mobilePosition).toBe('static');
  await assertNoOverflow();
});

test('all new-tab links carry both opener protections', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.repository-card')).toHaveCount(24);
  const insecureLinks = await page.locator('a[target="_blank"]').evaluateAll((links) => links.filter((link) => {
    const rel = new Set(link.rel.split(/\s+/));
    return !rel.has('noopener') || !rel.has('noreferrer');
  }).map((link) => link.href));
  expect(insecureLinks).toEqual([]);
});

test('load-more wrapper remains absent when JavaScript is disabled', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');

  await expect(page.locator('.load-more')).toHaveAttribute('hidden', '');
  await expect(page.locator('.load-more')).toBeHidden();
  await context.close();
});
