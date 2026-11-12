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
  // Playwright's default 1280x720 viewport: 480x270 at 2x (960x540).
  expect(await page.evaluate(() => window.__latentia?.layout())).toMatchObject({ mode: 'landscape', scale: 2, logical: { width: 480, height: 270 } });
  await expectCanvasMatchesLayout(page);

  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe('Overworld');
  expect(await step(page)).toBe('lab');

  // Entering the Lab saved the journey step.
  const saved = await page.evaluate(() => window.localStorage.getItem('latentia.save.v0'));
  expect(JSON.parse(saved ?? 'null')).toMatchObject({ schemaVersion: 3, progress: { step: 'lab' }, hintsSeen: [] });

  // After a reload the title offers Continue, and Continue resumes at the Lab.
  await page.reload();
  await expect.poll(() => scene(page)).toBe('Title');
  expect(await menu(page)).toMatchObject({ items: ['CONTINUE', 'NEW GAME'], index: 0 });
  await page.keyboard.press('KeyZ');
  await expect.poll(() => scene(page)).toBe('Overworld');

  expect(errors).toEqual([]);
});

test('with a save, NEW GAME by keyboard asks first: A A and Escape keep the save, START OVER resets it', async ({ page }) => {
  const errors = watchErrors(page);
  const raw = () => page.evaluate(() => window.localStorage.getItem('latentia.save.v0'));
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await page.evaluate(() => window.__latentia?.send({ type: 'newGame' }));
  await page.evaluate(() => window.__latentia?.send({ type: 'starterPicked', starter: 'blitzr' }));
  await expect.poll(() => step(page)).toBe('rival');
  await page.reload();
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title', items: ['CONTINUE', 'NEW GAME'], index: 0 });
  const before = await raw();

  // Down to NEW GAME, then Enter twice: the panel opens on CANCEL, so the second Enter backs out.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title-confirm', index: 1 });
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title' });
  // Escape (B) backs out too.
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title-confirm');
  await page.keyboard.press('Escape');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title');
  expect(await scene(page)).toBe('Title');
  expect(await raw()).toBe(before);

  // NEW GAME, up to START OVER, Enter: a fresh run in the lab.
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title-confirm');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title-confirm', index: 0 });
  await page.keyboard.press('Enter');
  await expect.poll(() => step(page)).toBe('lab');
  expect(JSON.parse((await raw()) ?? 'null')).toMatchObject({ progress: { step: 'lab', starter: null } });
  expect(errors).toEqual([]);
});

test('the touch controls and the hook drive the same flow: lab dialogue, starter pick, a lost and a won battle', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await expect(page.locator('#controls')).toBeVisible();
  expect(await page.evaluate(() => window.__latentia?.layout())).toMatchObject({ mode: 'portrait', controls: 'overlay' });
  await expectCanvasMatchesLayout(page);

  // Tap the A button.
  await page.locator('[data-control="btn-a"]').tap();
  await expect.poll(() => scene(page)).toBe('Overworld');

  // In the lab, Prof. Epoch talks first: hold A to speed his lines up, then A through them; the starter panel opens.
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyZ');
  await expect
    .poll(async () => {
      if ((await menu(page))?.id === 'starter') return true;
      await page.evaluate(() => window.__latentia?.press('a'));
      return false;
    })
    .toBe(true);
  await expect.poll(() => menu(page)).toMatchObject({ id: 'starter', index: 0 });

  // D-pad down to Blitzr, then a pointer pick through the hook confirms it.
  await page.locator('[data-control="dpad-down"]').tap();
  await expect.poll(() => menu(page)).toMatchObject({ id: 'starter', index: 1 });
  await page.evaluate(() => window.__latentia?.pick('starter', 1));
  await expect.poll(() => scene(page)).toBe('Battle');
  expect(await page.evaluate(() => window.__latentia?.flow())).toMatchObject({ step: 'rival', starter: 'blitzr', attempt: 0 });

  // The real battle opens. A loss restarts the same battle.
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('rival');
  expect(await page.evaluate(() => window.__latentia?.send({ type: 'battleLost' }))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().attempt)).toBe(1);
  await expect.poll(() => scene(page)).toBe('Battle');
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.phase ?? null)).toBe('intro');
  expect(await page.evaluate(() => window.__latentia?.send({ type: 'battleWon' }))).toBe(true);
  await expect.poll(() => step(page)).toBe('walk');
  await expect.poll(() => scene(page)).toBe('Overworld');

  // Rotating to landscape re-lays out: the game resized to 480x270, letterboxed and still pixel-exact.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.__latentia?.layout().mode)).toBe('landscape');
  await expect.poll(() => page.locator('#frame canvas').getAttribute('width')).toBe('480');
  await expectCanvasMatchesLayout(page);

  expect(errors).toEqual([]);
  await context.close();
});

test('every stub scene renders without errors through to the end card and back to the title', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  const walk: Array<[FlowEvent, string]> = [
    [{ type: 'newGame' }, 'Overworld'],
    [{ type: 'starterPicked', starter: 'forkling' }, 'Battle'],
    [{ type: 'battleWon' }, 'Overworld'],
    [{ type: 'reachedTrailhead' }, 'Battle'],
    [{ type: 'battleWon' }, 'Distill'],
    [{ type: 'distillChosen', choice: 'spinUp' }, 'Overworld'],
    [{ type: 'cardChosen', cardId: 'tutorial.a' }, 'Overworld'],
    [{ type: 'trainerEngaged' }, 'Battle'],
    [{ type: 'battleLost' }, 'Debrief'],
    [{ type: 'rematch', cardId: 'tutorial.b' }, 'Battle'],
    [{ type: 'battleWon' }, 'Debrief'],
    [{ type: 'finish' }, 'End'],
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

test('with localStorage blocked the game still runs, shows one "saves unavailable" notice, and plays into the lab', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await expect(page.locator('#notice')).toHaveCount(1);
  await expect(page.locator('#notice')).toHaveAttribute('aria-label', 'SAVES UNAVAILABLE');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe('Overworld');
  expect(await step(page)).toBe('lab');
  await expect(page.locator('#notice')).toHaveCount(1);
  expect(errors).toEqual([]);
});
