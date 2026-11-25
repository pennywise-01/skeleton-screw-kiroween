import { test, expect } from '@playwright/test';

test('full a11y workflow in demo mode', async ({ page }) => {
  await page.goto('/a11y');
  await page.getByRole('dialog').getByRole('button', { name: /Enter if you dare/ }).click();

  // Load the seeded broken example
  await page.getByRole('button', { name: 'Load Haunted Example' }).click();

  // Scan finds the seeded ghosts
  await page.getByRole('button', { name: 'Scan for Ghosts' }).click();
  await expect(page.getByRole('heading', { name: /Ghosts Found \(/ })).toBeVisible();
  const fixButtons = page.getByRole('button', { name: '✨ Exorcise' });
  expect(await fixButtons.count()).toBeGreaterThan(0);

  // Fix All applies the cached fix and re-scans to zero ghosts
  await page.getByRole('button', { name: 'Fix All' }).click();
  await expect(page.getByRole('heading', { name: 'Exorcised Files' })).toBeVisible();
  await expect(page.getByText('0 remaining')).toBeVisible();
  await expect(page.getByText(/All ghosts banished/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Exorcised Files' })).toBeVisible();
});
