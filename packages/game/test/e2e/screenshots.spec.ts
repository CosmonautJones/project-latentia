// Title-scene screenshots at a desktop landscape and a phone portrait size, committed for layout review.
// Run with `pnpm --filter @latentia/game screenshots`; the normal e2e run skips this file.

import { expect, test } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';
import { at, face, LOCALHOST, ow, walkTo } from './walk.js';

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

// Battle screenshots: the rival fight after one round with the move menu open (landscape: on the canvas; portrait: in
// the band; landscape touch: with the D-pad and A/B beside the game), then a moment of playback.
const BATTLE_SIZES = [
  { name: 'battle-1366x768', width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'battle-390x844', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'battle-375x667', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'battle-844x390', width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
] as const;

for (const s of BATTLE_SIZES) {
  test(s.name, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.deviceScaleFactor,
      isMobile: s.isMobile,
      hasTouch: s.hasTouch,
    });
    const page = await context.newPage();
    const hook = <T>(fn: () => T) => page.evaluate(fn);
    const pick = (menuId: string, i: number) => page.evaluate(([m, n]) => window.__latentia?.pick(m as string, n as number), [menuId, i] as const);
    await page.goto('/');
    await expect.poll(() => hook(() => window.__latentia?.scene() ?? null)).toBe('Title');
    await hook(() => window.__latentia?.send({ type: 'newGame' }));
    await hook(() => window.__latentia?.send({ type: 'starterPicked', starter: 'sagelet' }));
    const toCommand = () =>
      expect
        .poll(async () => {
          const phase = await hook(() => window.__latentia?.battle()?.phase ?? null);
          if (phase === 'intro' || phase === 'hint') await hook(() => window.__latentia?.press('a'));
          return phase;
        }, { timeout: 20_000 })
        .toBe('command');
    await toCommand();
    // Round 1: Step-Back Prompt (a buff), so round 2 shows context used and a damaged bar.
    await pick('battle-root', 0);
    await toCommand();
    await pick('battle-moves', 2);
    await pick('battle-moves', 2);
    await toCommand();
    await pick('battle-root', 0);
    // A first tap on Happy to Help: selected, its hint up, waiting for the second tap.
    await pick('battle-moves', 0);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test/screenshots/${s.name}.png` });
    await pick('battle-moves', 0);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test/screenshots/${s.name}-playback.png` });
    await context.close();
  });
}

// Overworld screenshots: the lab just after the rival fight, then the trailhead (sign, the wild patch and Bootcamp
// Grad beyond it), walked to with real input, and the sign read out in the dialogue box.
const OVERWORLD_SIZES = [
  { name: 'overworld-1366x768', width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'overworld-390x844', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'overworld-375x667', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
] as const;

for (const s of OVERWORLD_SIZES) {
  test(s.name, async ({ browser }) => {
    test.setTimeout(60_000);
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
    await hook(() => window.__latentia?.send({ type: 'starterPicked', starter: 'blitzr' }));
    await expect.poll(() => hook(() => window.__latentia?.battle()?.id ?? null)).toBe('rival');
    await hook(() => window.__latentia?.send({ type: 'battleWon' }));
    await expect.poll(() => ow(page)).not.toBeNull();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test/screenshots/${s.name}-lab.png` });
    const sign = LOCALHOST.signs[0]!;
    await walkTo(page, at('outside', sign.at.x, sign.at.y + 1));
    await face(page, 'up');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test/screenshots/${s.name}.png` });
    await page.keyboard.press('KeyZ');
    await expect.poll(() => ow(page).then((o) => o?.dialogue)).toBe(sign.text);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `test/screenshots/${s.name}-sign.png` });
    await context.close();
  });
}
