import { defineConfig } from 'vitest/config';

// Locally: Google Chrome via the `chrome` channel (Playwright browser download is blocked).
// In CI: BROWSER=chromium|webkit uses Playwright-installed browsers.
const browser = process.env['BROWSER'] ?? 'chromium';
const instance =
  browser === 'chromium' && !process.env['CI']
    ? { browser: 'chromium' as const, launch: { channel: 'chrome' } }
    : { browser: browser as 'chromium' | 'webkit' };

// The cross-runtime run (spec §2 criterion 1): the golden files, the property suites and the unit tests.
// Excluded: the lint test (runs ESLint through Node) and the fuzz suite (Node only, sized by FUZZ_N).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/lint.test.ts', 'test/fuzz/**', 'node_modules/**'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [instance],
    },
  },
});
