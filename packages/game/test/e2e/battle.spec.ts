// The rival battle end to end on the real engine: new game → starter → Kip, driven through the dev hook until a
// result arrives. Also checks hidden foe intents, the first-time hints (and that they are saved), the TEMP dial,
// WHY?, LOG, the speed toggle, the round timing (animation within 1.5 s), the portrait band with two-tap commit, a
// short phone reaching all seven moves, and landscape touch controls clear of the game. Any console error fails.

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

const ROOT = { prompt: 0, temp: 1, why: 2, log: 3, speed: 4 } as const;
const battle = (page: Page) => page.evaluate(() => window.__latentia?.battle() ?? null);
const menu = (page: Page) => page.evaluate(() => window.__latentia?.menu() ?? null);
const phase = async (page: Page) => (await battle(page))?.phase ?? null;
const pick = (page: Page, menuId: string, i: number) => page.evaluate(([m, n]) => window.__latentia?.pick(m as string, n as number), [menuId, i] as const);

/** New game → close the professor's line → pick a starter → the rival battle's intro is up. */
async function startRival(page: Page, starterIndex: number): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__latentia?.scene() ?? null)).toBe('Title');
  await page.evaluate(() => window.__latentia?.send({ type: 'newGame' }));
  await expect.poll(() => page.evaluate(() => window.__latentia?.scene() ?? null)).toBe('Overworld');
  await expect
    .poll(async () => {
      if ((await menu(page))?.id === 'starter') return true;
      await page.evaluate(() => window.__latentia?.press('a'));
      return false;
    })
    .toBe(true);
  await pick(page, 'starter', starterIndex);
  await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('rival');
}

/** Close dialogue (intro, hints, why) until the command menu is up (or the battle is over). */
async function toCommand(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const p = await phase(page);
        if (p === 'intro' || p === 'why' || p === 'hint') await page.evaluate(() => window.__latentia?.press('a'));
        return p === 'command' || p === 'result';
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** One round: PROMPT, then the first affordable damaging move (Compact when nothing fits), tapped twice. */
async function attack(page: Page): Promise<void> {
  await pick(page, 'battle-root', ROOT.prompt);
  await toCommand(page);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
  const moves = (await battle(page))?.moves ?? [];
  const best = moves.findIndex((m) => m.damaging && m.affordable);
  const index = best >= 0 ? best : moves.findIndex((m) => m.moveId === 'compact');
  await pick(page, 'battle-moves', index);
  // The first tap only selects (and shows the hint); the second commits.
  expect((await phase(page)) === 'command' && (await menu(page))?.id === 'battle-moves').toBe(true);
  await pick(page, 'battle-moves', index);
  if ((await menu(page))?.id === 'battle-targets') {
    await pick(page, 'battle-targets', 0);
    await pick(page, 'battle-targets', 0);
  }
}

test('the rival battle plays to a result on the engine, and the result reaches the flow', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await startRival(page, 0);
  // A mouse click on the game advances dialogue like A (the intro, then the first-time PROMPT hint).
  await expect
    .poll(async () => {
      if ((await phase(page)) === 'intro') await page.locator('#frame canvas').click();
      return phase(page);
    })
    .not.toBe('intro');
  await toCommand(page);
  expect(await menu(page)).toEqual({ id: 'battle-root', items: ['PROMPT', 'TEMP T2', 'WHY?', 'LOG', 'SPEED 1×'], index: 0 });
  // Kip's plan is hidden: the preview shows only "?".
  expect((await battle(page))?.intents).toEqual(["Kip's Blitzr: ?"]);
  // The PROMPT hint was shown once and saved.
  const saved = JSON.parse((await page.evaluate(() => window.localStorage.getItem('latentia.save.v0'))) ?? 'null') as { hintsSeen: string[] };
  expect(saved.hintsSeen).toContain('battle.prompt');

  // TEMP (with its first-time hint): turn the dial up one notch; B backs out of the move list.
  await pick(page, 'battle-root', ROOT.temp);
  await toCommand(page);
  await page.evaluate(() => window.__latentia?.press('right'));
  await page.evaluate(() => window.__latentia?.press('a'));
  expect((await battle(page))?.temperature).toBe(3);
  await pick(page, 'battle-root', ROOT.prompt);
  await toCommand(page);
  await page.evaluate(() => window.__latentia?.press('b'));
  expect((await menu(page))?.id).toBe('battle-root');

  // Two rounds at 1×: the animation fits 1.5 s, every line gets its dwell, and the wall clock follows the plan.
  for (let i = 0; i < 2 && (await phase(page)) === 'command'; i++) {
    await attack(page);
    await toCommand(page);
  }
  const b = await battle(page);
  expect(b?.roundMs.length).toBeGreaterThan(0);
  for (const r of b?.roundMs ?? []) {
    expect(r.animMs).toBeLessThanOrEqual(1500);
    expect(r.actualMs).toBeLessThanOrEqual(r.plannedMs + 150);
  }

  if ((await phase(page)) === 'command') {
    // WHY? explains Kip's last card, after the fact; B closes it.
    await pick(page, 'battle-root', ROOT.why);
    await expect.poll(() => phase(page)).toBe('why');
    expect((await battle(page))?.why).toMatch(/Kip's Blitzr (fired|fell back)/);
    await page.evaluate(() => window.__latentia?.press('b'));
    await expect.poll(() => phase(page)).toBe('command');
    // LOG lists the rounds so far; B closes it.
    await pick(page, 'battle-root', ROOT.log);
    expect((await menu(page))?.id).toBe('battle-log');
    expect((await menu(page))?.items[0]).toMatch(/^R1 /);
    await page.evaluate(() => window.__latentia?.press('b'));
    expect((await menu(page))?.id).toBe('battle-root');
    // 2× for the rest.
    await pick(page, 'battle-root', ROOT.speed);
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

test('a lose → restart keeps the temperature and speed the player set', async ({ page }) => {
  const errors = watchErrors(page);
  await startRival(page, 1);
  await toCommand(page);
  await pick(page, 'battle-root', ROOT.temp);
  await toCommand(page);
  await page.evaluate(() => window.__latentia?.press('left'));
  await page.evaluate(() => window.__latentia?.press('a'));
  await pick(page, 'battle-root', ROOT.speed);
  expect(await battle(page)).toMatchObject({ temperature: 1, speed: 2 });
  await page.evaluate(() => window.__latentia?.send({ type: 'battleLost' }));
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().attempt)).toBe(1);
  await expect.poll(() => phase(page)).toBe('intro');
  expect(await battle(page)).toMatchObject({ temperature: 1, speed: 2 });
  expect(errors).toEqual([]);
});

test('in portrait the battle menu is in the band: taps select, a second tap commits', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 2);
  await toCommand(page);
  const band = page.locator('#band-panel');
  await expect(band.locator('[data-menu="battle-root"]')).toHaveCount(5);
  await band.locator('[data-menu="battle-root"][data-index="0"]').click();
  // The first visit to the moves shows the context hint; the band's A closes it.
  await expect.poll(() => phase(page)).toBe('hint');
  await expect
    .poll(async () => {
      if ((await phase(page)) === 'hint') await page.locator('[data-control="btn-a"]').click();
      return phase(page);
    })
    .toBe('command');
  await expect(band.locator('[data-menu="battle-moves"]')).toHaveCount(7);
  for (const b of await band.locator('.band-btn').all()) expect((await b.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  // B (the band's B button) backs out to the root.
  await page.locator('[data-control="btn-b"]').click();
  await expect(band.locator('[data-menu="battle-root"]')).toHaveCount(5);
  await band.locator('[data-menu="battle-root"][data-index="0"]').click();
  const first = band.locator('[data-menu="battle-moves"][data-index="0"]');
  await first.click();
  await expect(band.locator('.band-btn.armed')).toHaveCount(1);
  expect(await phase(page)).toBe('command');
  await band.locator('[data-menu="battle-moves"][data-index="0"]').click();
  await expect.poll(() => phase(page)).toBe('playback');
  await toCommand(page);
  expect((await battle(page))?.round).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('a 375×667 phone reaches all seven moves, Guardrail included', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 0);
  await toCommand(page);
  const band = page.locator('#band-panel');
  await band.locator('[data-menu="battle-root"][data-index="0"]').click();
  await toCommand(page);
  await expect(band.locator('[data-menu="battle-moves"]')).toHaveCount(7);
  const guardrail = band.locator('[data-menu="battle-moves"][data-index="6"]');
  await guardrail.click();
  await guardrail.click();
  await expect.poll(() => phase(page)).not.toBe('command');
  expect(errors).toEqual([]);
  await context.close();
});

test('landscape touch puts the D-pad and A/B beside the game, never over it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 0);
  expect(await page.evaluate(() => window.__latentia?.layout().controls)).toBe('sides');
  const canvas = await page.locator('#frame canvas').boundingBox();
  if (!canvas) throw new Error('no canvas');
  for (const b of await page.locator('#controls .touch-btn').all()) {
    const r = await b.boundingBox();
    if (!r) throw new Error('no button box');
    const overlaps = r.x < canvas.x + canvas.width && r.x + r.width > canvas.x && r.y < canvas.y + canvas.height && r.y + r.height > canvas.y;
    expect(overlaps).toBe(false);
  }
  expect(errors).toEqual([]);
  await context.close();
});
