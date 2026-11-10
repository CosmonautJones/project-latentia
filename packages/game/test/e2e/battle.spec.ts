// The rival battle end to end on the real engine: new game → starter → Kip, driven through the dev hook until a
// result arrives. Also checks the TEMP dial, the WHY? popup, the speed toggle, the 1.5 s turn budget, and the
// portrait band menu. Any console error fails the test.

import { expect, test, type Page } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const battle = (page: Page) => page.evaluate(() => window.__latentia?.battle() ?? null);
const menu = (page: Page) => page.evaluate(() => window.__latentia?.menu() ?? null);
const phase = async (page: Page) => (await battle(page))?.phase ?? null;

/** New game → close the professor's line → pick a starter → the rival battle's intro is up. */
async function startRival(page: Page, starterIndex: number): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__latentia?.scene() ?? null)).toBe('Title');
  await page.evaluate(() => window.__latentia?.send({ type: 'newGame' }));
  await expect.poll(() => page.evaluate(() => window.__latentia?.scene() ?? null)).toBe('Lab');
  await expect
    .poll(async () => {
      if ((await menu(page))?.id === 'starter') return true;
      await page.evaluate(() => window.__latentia?.press('a'));
      return false;
    })
    .toBe(true);
  await page.evaluate((i) => window.__latentia?.pick('starter', i), starterIndex);
  await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('rival');
}

/** Close dialogue until the command menu is up (or the battle is over). */
async function toCommand(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const p = await phase(page);
        if (p === 'intro' || p === 'why') await page.evaluate(() => window.__latentia?.press('a'));
        return p === 'command' || p === 'result';
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/** One round: PROMPT, then the first affordable damaging move (Compact when nothing fits). */
async function attack(page: Page): Promise<void> {
  await page.evaluate(() => window.__latentia?.pick('battle-root', 0));
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
  const b = await battle(page);
  const moves = b?.moves ?? [];
  const pick = Math.max(0, moves.findIndex((m) => m.damaging && m.affordable)) || moves.findIndex((m) => m.moveId === 'compact');
  await page.evaluate((i) => window.__latentia?.pick('battle-moves', i), pick);
  const m = await menu(page);
  if (m?.id === 'battle-targets') await page.evaluate(() => window.__latentia?.pick('battle-targets', 0));
}

test('the rival battle plays to a result on the engine, and the result reaches the flow', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await startRival(page, 0);
  await toCommand(page);
  expect(await menu(page)).toEqual({ id: 'battle-root', items: ['PROMPT', 'TEMP T2', 'WHY?', 'SPEED 1×'], index: 0 });
  // Kip's next move is previewed before we commit.
  expect((await battle(page))?.intents[0]).toMatch(/^Kip's Blitzr: /);

  // TEMP: turn the dial up one notch; B backs out of the move list.
  await page.evaluate(() => window.__latentia?.pick('battle-root', 1));
  await page.evaluate(() => window.__latentia?.press('right'));
  await page.evaluate(() => window.__latentia?.press('a'));
  expect((await battle(page))?.temperature).toBe(3);
  await page.evaluate(() => window.__latentia?.pick('battle-root', 0));
  await page.evaluate(() => window.__latentia?.press('b'));
  expect((await menu(page))?.id).toBe('battle-root');

  // Two rounds at 1×: each resolves inside 1.5 s.
  for (let i = 0; i < 2; i++) {
    await attack(page);
    await toCommand(page);
  }
  const b = await battle(page);
  expect(b?.roundMs.length).toBeGreaterThan(0);
  for (const ms of b?.roundMs ?? []) expect(ms).toBeLessThanOrEqual(1500);

  if ((await phase(page)) === 'command') {
    // WHY? explains Kip's last card in plain words; B closes it.
    await page.evaluate(() => window.__latentia?.pick('battle-root', 2));
    await expect.poll(() => phase(page)).toBe('why');
    expect((await battle(page))?.why).toMatch(/Kip's Blitzr (fired|fell back)/);
    await page.evaluate(() => window.__latentia?.press('b'));
    await expect.poll(() => phase(page)).toBe('command');
    // 2× for the rest.
    await page.evaluate(() => window.__latentia?.pick('battle-root', 3));
    expect((await battle(page))?.speed).toBe(2);
  }

  for (let i = 0; i < 60 && (await phase(page)) === 'command'; i++) {
    await attack(page);
    await toCommand(page);
  }
  const result = (await battle(page))?.result;
  expect(result).not.toBeNull();
  expect(['win', 'lose', 'draw']).toContain(result?.outcome);

  // Close the result line: a win moves on to the walk, a loss restarts the rival fight.
  const before = await page.evaluate(() => window.__latentia?.flow());
  await expect
    .poll(async () => {
      const f = await page.evaluate(() => window.__latentia?.flow());
      if (f?.step === 'rival' && f.attempt === before?.attempt) await page.evaluate(() => window.__latentia?.press('a'));
      return f?.step === 'walk' || (f?.step === 'rival' && f.attempt === (before?.attempt ?? 0) + 1);
    })
    .toBe(true);
  expect(errors).toEqual([]);
});

test('in portrait the battle menu is in the band and taps drive it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 2);
  await toCommand(page);
  const band = page.locator('#band-panel');
  await expect(band.locator('[data-menu="battle-root"]')).toHaveCount(4);
  await band.locator('[data-menu="battle-root"][data-index="0"]').click();
  await expect(band.locator('[data-menu="battle-moves"]')).toHaveCount(7);
  // B (the band's B button) backs out to the root.
  await page.locator('[data-control="btn-b"]').click();
  await expect(band.locator('[data-menu="battle-root"]')).toHaveCount(4);
  await band.locator('[data-menu="battle-root"][data-index="0"]').click();
  await band.locator('[data-menu="battle-moves"][data-index="0"]').click();
  await expect.poll(() => phase(page)).toBe('playback');
  await toCommand(page);
  expect((await battle(page))?.round).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});
