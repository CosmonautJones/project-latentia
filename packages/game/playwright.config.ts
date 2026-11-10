import { defineConfig } from '@playwright/test';

// Locally: Google Chrome via the `chrome` channel (the Playwright browser download is blocked here).
// In CI: Playwright's own Chromium, installed with `playwright install chromium`.
const chrome = process.env['CI'] ? {} : { channel: 'chrome' };
const port = 4317;

export default defineConfig({
  testDir: 'test/e2e',
  // The screenshot spec rewrites the committed PNGs, so it only runs via `pnpm screenshots`.
  testIgnore: process.env['SCREENSHOTS'] ? [] : ['**/screenshots.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    ...chrome,
  },
  webServer: {
    command: `vite preview --outDir dist-test --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
