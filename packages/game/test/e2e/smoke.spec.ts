import { expect, test, type Page } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';
import type { FlowEvent } from '../../src/flow/flow.js';

/** Collect console errors and uncaught exceptions; the test fails on any. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const scene = (page: Page) => page.evaluate(() => window.__latentia?.scene() ?? null);
const step = (page: Page) => page.evaluate(() => window.__latentia?.flow().step ?? null);
const menu = (page: Page) => page.evaluate(() => window.__latentia?.menu() ?? null);

/** The canvas fills exactly the integer-scaled rect the layout manager computed. */
async function expectCanvasMatchesLayout(page: Page): Promise<void> {
  const game = await page.evaluate(() => window.__latentia?.layout().game);
  await expect.poll(() => page.locator('#frame canvas').boundingBox()).toEqual(game);
}

test('boots to the title, starts a new game by keyboard and reaches the Lab', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');

  await expect.poll(() => scene(page)).toBe('Title');
  expect(await step(page)).toBe('title');
  // A fresh browser has no save: only New Game.
  expect(await menu(page)).toMatchObject({ id: 'title', items: ['NEW GAME'] });
  await expect(page.locator('#frame canvas')).toBeVisible();
  // Playwright's default 1280x720 viewport: exactly 4x.
  expect(await page.evaluate(() => window.__latentia?.layout())).toMatchObject({ mode: 'landscape', scale: 4 });
  await expectCanvasMatchesLayout(page);

  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe('Lab');
  expect(await step(page)).toBe('lab');

  // Entering the Lab saved the journey step.
  const saved = await page.evaluate(() => window.localStorage.getItem('latentia.save.v0'));
  expect(JSON.parse(saved ?? 'null')).toMatchObject({ schemaVersion: 2, progress: { step: 'lab' }, hintsSeen: [] });

  // After a reload the title offers Continue, and Continue resumes at the Lab.
  await page.reload();
  await expect.poll(() => scene(page)).toBe('Title');
  expect(await menu(page)).toMatchObject({ items: ['CONTINUE', 'NEW GAME'], index: 0 });
  await page.keyboard.press('KeyZ');
  await expect.poll(() => scene(page)).toBe('Lab');

  expect(errors).toEqual([]);
});

test('the touch band and the hook drive the same flow: lab dialogue, starter pick, a lost and a won battle', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await expect(page.locator('#band')).toBeVisible();
  expect(await page.evaluate(() => window.__latentia?.layout())).toMatchObject({ mode: 'portrait', controls: 'band' });
  await expectCanvasMatchesLayout(page);

  // Tap A in the band.
  await page.locator('[data-control="btn-a"]').click();
  await expect.poll(() => scene(page)).toBe('Lab');

  // Hold A to speed the professor's line up, then A to close it; the starter menu takes the cursor.
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyZ');
  await page.evaluate(() => window.__latentia?.press('a'));
  await expect.poll(() => menu(page)).toMatchObject({ id: 'starter', index: 0 });

  // D-pad down to Blitzr, then a pointer pick through the hook confirms it.
  await page.locator('[data-control="dpad-down"]').click();
  await expect.poll(() => menu(page)).toMatchObject({ id: 'starter', index: 1 });
  await page.evaluate(() => window.__latentia?.pick('starter', 1));
  await expect.poll(() => scene(page)).toBe('Battle');
  expect(await page.evaluate(() => window.__latentia?.flow())).toMatchObject({ step: 'rival', starter: 'blitzr', attempt: 0 });

  // The real battle opens; in portrait its menu lives in the band. A loss restarts the same battle.
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('rival');
  expect(await page.evaluate(() => window.__latentia?.send({ type: 'battleLost' }))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().attempt)).toBe(1);
  await expect.poll(() => scene(page)).toBe('Battle');
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.phase ?? null)).toBe('intro');
  expect(await page.evaluate(() => window.__latentia?.send({ type: 'battleWon' }))).toBe(true);
  await expect.poll(() => step(page)).toBe('walk');
  await expect.poll(() => scene(page)).toBe('Overworld');

  // Rotating to landscape re-lays out: no band, the screen letterboxed and still pixel-exact.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.__latentia?.layout().mode)).toBe('landscape');
  await expect(page.locator('#band')).toBeHidden();
  await expectCanvasMatchesLayout(page);

  expect(errors).toEqual([]);
});

test('every stub scene renders without errors through to the end card and back to the title', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  const walk: Array<[FlowEvent, string]> = [
    [{ type: 'newGame' }, 'Lab'],
    [{ type: 'starterPicked', starter: 'forkling' }, 'Battle'],
    [{ type: 'battleWon' }, 'Overworld'],
    [{ type: 'reachedTrailhead' }, 'Battle'],
    [{ type: 'battleWon' }, 'Battle'],
    [{ type: 'distillChosen', choice: 'spinUp' }, 'Overworld'],
    [{ type: 'cardChosen', cardId: 'tutorial.a' }, 'Battle'],
    [{ type: 'battleWon' }, 'End'],
    [{ type: 'backToTitle' }, 'Title'],
  ];
  for (const [event, expected] of walk) {
    expect(await page.evaluate((e) => window.__latentia?.send(e), event)).toBe(true);
    await expect.poll(() => scene(page)).toBe(expected);
    // Let a few frames of the new scene run (dialogue typing, menus).
    await page.waitForTimeout(100);
  }
  expect(await menu(page)).toMatchObject({ id: 'title', items: ['CONTINUE', 'NEW GAME'] });
  expect(errors).toEqual([]);
});
