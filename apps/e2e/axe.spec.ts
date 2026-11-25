import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

async function dismissInfoModal(page: Page) {
  // No isVisible guard: getByRole auto-waits for the modal to hydrate and appear
  await page.getByRole('dialog').getByRole('button', { name: /Enter if you dare/ }).click();
}

test('landing page clean', async ({ page }) => {
  await page.goto('/');
  expect(await seriousViolations(page)).toEqual([]);
});

test('lambda: prompt, spec, and generated code states clean', async ({ page }) => {
  await page.goto('/lambda');
  await dismissInfoModal(page);
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByPlaceholder('Describe your Lambda function...').fill('Resize images');
  await page.getByRole('button', { name: 'Generate Spec' }).click();
  await expect(page.getByRole('heading', { name: 'Spec (edit as needed)' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Generate Code' }).click();
  await expect(page.getByRole('heading', { name: 'Generated Code' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('a11y: upload, findings, and exorcised states clean', async ({ page }) => {
  await page.goto('/a11y');
  await dismissInfoModal(page);
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Load Haunted Example' }).click();
  await page.getByRole('button', { name: 'Scan for Ghosts' }).click();
  await expect(page.getByRole('heading', { name: /Ghosts Found \(/ })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Fix All' }).click();
  await expect(page.getByText(/All ghosts banished/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
