import {env} from 'node:process';
import {test, expect} from '@playwright/test';
import {login, apiCreateRepo, apiCreateFile, randomString, baseUrl} from './utils.ts';
import type {APIRequestContext} from '@playwright/test';

async function createCompareRepo(request: APIRequestContext, owner: string) {
  const repoName = `e2e-compare-${randomString(8)}`;
  await apiCreateRepo(request, {name: repoName});
  await apiCreateFile(request, owner, repoName, 'feat.txt', 'feature content\n', {branch: 'main', newBranch: 'feat'});
  return repoName;
}

test('loads compare results asynchronously and keeps the full-page fallback', async ({page, request}) => {
  const owner = env.GITEA_TEST_E2E_USER;
  const repoName = await createCompareRepo(request, owner);
  await login(page);
  const compareResultRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('compare-result=true')) compareResultRequests.push(request.url());
  });
  await page.goto(`/${owner}/${repoName}/compare/main...feat`);

  await expect(page.locator('#compare-result')).toBeVisible();
  await expect(page.locator('#compare-result #diff-file-boxes .diff-file-header')).toBeVisible();
  expect(compareResultRequests).toHaveLength(1);
  await expect(page.locator('#compare-result #new-issue')).toBeAttached();
  const prButton = page.locator('button[data-compare-pr-button]');
  await expect(prButton).toBeEnabled();
  await prButton.click();
  await expect(page.locator('#compare-result #new-issue')).toBeVisible();

  const fallbackResponse = await page.request.get(`${baseUrl()}/${owner}/${repoName}/compare/main...feat?compare-full=true`);
  expect(fallbackResponse.ok()).toBeTruthy();
  const fallbackHTML = await fallbackResponse.text();
  expect(fallbackHTML).toContain('id="diff-file-boxes"');
  expect(fallbackHTML).not.toContain('data-global-init="initCompareResult"');
});

test('handles an empty compare without a result request', async ({page, request}) => {
  const owner = env.GITEA_TEST_E2E_USER;
  const repoName = await createCompareRepo(request, owner);
  await login(page);
  const resultRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('compare-result=true')) resultRequests.push(request.url());
  });
  await page.goto(`/${owner}/${repoName}/compare/main...main`);

  await expect(page.getByText('There are no differences to show. There is no need to create a pull request.')).toBeVisible();
  await expect(page.locator('#diff-file-boxes')).toHaveCount(0);
  expect(resultRequests).toHaveLength(0);
});

test('supports the no-JavaScript full-page fallback', async ({browser, request}) => {
  const owner = env.GITEA_TEST_E2E_USER;
  const repoName = await createCompareRepo(request, owner);
  const context = await browser.newContext({javaScriptEnabled: false});
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto(`/${owner}/${repoName}/compare/main...feat`);
    await expect(page.locator('#diff-file-boxes .diff-file-header')).toBeVisible();
    expect(page.url()).toContain('compare-full=true');
    await expect(page.locator('[data-global-init="initCompareResult"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('create a pull request from the compare page', async ({page, request}) => {
  const repoName = `e2e-pr-create-${randomString(8)}`;
  const owner = env.GITEA_TEST_E2E_USER;
  await apiCreateRepo(request, {name: repoName});
  await Promise.all([
    apiCreateFile(request, owner, repoName, 'feat.txt', 'feature content\n', {branch: 'main', newBranch: 'feat'}),
    login(page),
  ]);
  // expand=1 renders the PR form directly, skipping the "New Pull Request" toggle click
  await page.goto(`/${owner}/${repoName}/compare/main...feat?expand=1`);
  await expect(page.locator('#compare-result')).toBeVisible();
  await expect(page.locator('#compare-result #diff-file-boxes .diff-file-header')).toBeVisible();
  await expect(page.locator('#compare-result #new-issue')).toBeVisible();

  const title = `e2e-pr-${randomString(8)}`;
  await page.getByPlaceholder('Title').fill(title);
  await page.getByRole('button', {name: 'Create Pull Request'}).click();

  // commit, not full load: the PR title heading is server-rendered, so the assertion can resolve before the heavy diff/timeline finishes
  await page.waitForURL(new RegExp(`/${owner}/${repoName}/pulls/\\d+$`), {waitUntil: 'commit'});
  await expect(page.getByRole('heading', {name: title})).toBeVisible();
});
