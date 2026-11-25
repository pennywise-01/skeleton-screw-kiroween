import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  use: {
    baseURL: 'http://localhost:3100',
  },
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100',
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      DEMO_MODE: 'true',
    },
  },
});
