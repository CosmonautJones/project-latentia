// Title-scene screenshots at a desktop landscape and a phone portrait size, committed for layout review.
// Run with `pnpm --filter @latentia/game screenshots`; the normal e2e run skips this file.

import { expect, test } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';

const SIZES = [
  { name: 'title-1366x768', width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'title-390x844', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
] as const;

for (const s of SIZES) {
  test(s.name, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.deviceScaleFactor,
      isMobile: s.isMobile,
      hasTouch: s.hasTouch,
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.__latentia?.scene() ?? null)).toBe('Title');
    // Let one more frame render after the scene is up.
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test/screenshots/${s.name}.png` });
    await context.close();
  });
}
