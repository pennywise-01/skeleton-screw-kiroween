import { test, expect } from '@playwright/test';

test('full lambda workflow in demo mode', async ({ page }) => {
  await page.goto('/lambda');
  await page.getByRole('dialog').getByRole('button', { name: /Enter if you dare/ }).click();

  // Prompt -> spec
  await page.getByPlaceholder('Describe your Lambda function...').fill('Resize uploaded images');
  await page.getByRole('button', { name: 'Generate Spec' }).click();
  await expect(page.getByRole('heading', { name: 'Spec (edit as needed)' })).toBeVisible();

  // Spec -> code
  await page.getByRole('button', { name: 'Generate Code' }).click();
  await expect(page.getByRole('heading', { name: 'Generated Code' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'handler.js' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'handler.test.js' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3 Code' })).toBeVisible();

  // Manual-deploy card shows runtime guidance instead of a live deploy button
  await expect(page.getByText(/Deploy it yourself/)).toBeVisible();
  await expect(page.getByText(/AWS Lambda compatible/)).toBeVisible();
});
