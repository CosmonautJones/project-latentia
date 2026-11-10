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

// Battle screenshots: the rival fight after one round, with the move menu open (landscape: on the canvas; portrait:
// in the band), and a moment of playback.
for (const s of SIZES) {
  const name = s.name.replace('title', 'battle');
  test(name, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.deviceScaleFactor,
      isMobile: s.isMobile,
      hasTouch: s.hasTouch,
    });
    const page = await context.newPage();
    const hook = <T>(fn: () => T) => page.evaluate(fn);
    await page.goto('/');
    await expect.poll(() => hook(() => window.__latentia?.scene() ?? null)).toBe('Title');
    await hook(() => window.__latentia?.send({ type: 'newGame' }));
    await hook(() => window.__latentia?.send({ type: 'starterPicked', starter: 'sagelet' }));
    const toCommand = () =>
      expect
        .poll(async () => {
          const phase = await hook(() => window.__latentia?.battle()?.phase ?? null);
          if (phase === 'intro') await hook(() => window.__latentia?.press('a'));
          return phase;
        })
        .toBe('command');
    await toCommand();
    // Round 1: Step-Back Prompt (a buff), so round 2 shows a stage change and some context used.
    await hook(() => window.__latentia?.pick('battle-root', 0));
    await hook(() => window.__latentia?.pick('battle-moves', 2));
    await toCommand();
    await hook(() => window.__latentia?.pick('battle-root', 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test/screenshots/${name}.png` });
    // Happy to Help, caught mid-playback.
    await hook(() => window.__latentia?.pick('battle-moves', 0));
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test/screenshots/${name}-playback.png` });
    await context.close();
  });
}
