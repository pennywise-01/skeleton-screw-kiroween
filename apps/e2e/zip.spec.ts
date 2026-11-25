import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

test('auditor extracts a zip and scans its files', async ({ page }) => {
  // Build a small project zip in memory
  const zip = new JSZip();
  zip.file('src/Bad.tsx', 'export default function Bad() { return <img src="x.png" />; }');
  zip.file('node_modules/skip.tsx', 'export default function Skip() { return <img src="y.png" />; }');
  zip.file('README.md', '# not scanned');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  await page.goto('/a11y');
  await page.getByRole('dialog').getByRole('button', { name: /Enter if you dare/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'project.zip',
    mimeType: 'application/zip',
    buffer,
  });

  await page.getByRole('button', { name: 'Scan for Ghosts' }).click();

  // Findings appear, and only for src/Bad.tsx (node_modules is skipped)
  await expect(page.getByRole('heading', { name: /Ghosts Found \(/ })).toBeVisible();
  await expect(page.getByText(/src[\\/]Bad\.tsx/).first()).toBeVisible();
  await expect(page.getByText(/node_modules/)).toHaveCount(0);
});
