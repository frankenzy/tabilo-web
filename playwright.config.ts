import { defineConfig, devices } from '@playwright/test';

/**
 * Tests navigateur de bout en bout, contre l'application réelle :
 * frontend construit (next start) + API TABILO + PostgreSQL + Redis locaux.
 * Prérequis : l'API tourne sur NEXT_PUBLIC_API_URL (voir README).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3004',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3004',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
