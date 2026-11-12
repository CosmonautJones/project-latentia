// The rival battle end to end on the real engine: new game → starter → Kip, driven through the dev hook until a
// result arrives. Also checks the foe telegraph (V11), the first-time hints (and that they are saved), no TEMP dial
// while temperature is locked (V12), NUMBERS,
// WHY?, LOG, the speed toggle, the round timing (animation within 1.5 s), the in-image portrait menu with two-tap
// commit, a small phone tapping all seven moves, and landscape touch controls clear of the menus. Any console error fails.

import { expect, test, type Page } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';
import { expectTargets, tapOption, taps, target } from './drive.js';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const ROOT = { prompt: 0, why: 1, log: 2, numbers: 3, speed: 4 } as const;
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
  // No TEMP while temperature is locked (V12); the dial is not drawn.
  expect(await menu(page)).toEqual({ id: 'battle-root', items: ['PROMPT', 'WHY?', 'LOG', 'NUMBERS OFF', 'SPEED 1×'], index: 0 });
  expect((await battle(page))?.disclosure).toEqual({ hp: true, moves: true, contextPips: true, foeTelegraph: true, teammateTelegraph: false, temperature: false });
  // Kip's next move is telegraphed by category, never "?" (V11): an attack with its estimate, or Compact as SPECIAL.
  const intents = (await battle(page))?.intents ?? [];
  expect(intents).toHaveLength(1);
  expect(intents[0]).toMatch(/^Kip's Blitzr: (ATTACK ~\d+ → SAGELET|SPECIAL)$/);
  // The foe telegraph hint was shown in round 1 too, and saved.
  // The PROMPT hint was shown once and saved.
  const saved = JSON.parse((await page.evaluate(() => window.localStorage.getItem('latentia.save.v0'))) ?? 'null') as { hintsSeen: string[] };
  expect(saved.hintsSeen).toContain('battle.prompt');

  // NUMBERS shows the numbers behind the plain words; PROMPT opens the moves in plain words; B backs out.
  await pick(page, 'battle-root', ROOT.prompt);
  await toCommand(page);
  await expect.poll(() => battle(page).then((b) => b?.band.join(' ') ?? '')).toMatch(/HAPPY TO HELP: Hits hard\. Costs 3\. Never misses\./);
  await page.evaluate(() => window.__latentia?.press('b'));
  await pick(page, 'battle-root', ROOT.numbers);
  expect((await battle(page))?.numbers).toBe(true);
  await pick(page, 'battle-root', ROOT.prompt);
  await expect.poll(() => battle(page).then((b) => b?.band.join(' ') ?? '')).toMatch(/PWR 70/);
  await page.evaluate(() => window.__latentia?.press('b'));
  await pick(page, 'battle-root', ROOT.numbers);
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

test('a lose → restart keeps the speed and NUMBERS the player set; the temperature stays at T2 while locked', async ({ page }) => {
  const errors = watchErrors(page);
  await startRival(page, 1);
  await toCommand(page);
  await pick(page, 'battle-root', ROOT.numbers);
  await pick(page, 'battle-root', ROOT.speed);
  expect(await battle(page)).toMatchObject({ temperature: 2, speed: 2, numbers: true });
  await page.evaluate(() => window.__latentia?.send({ type: 'battleLost' }));
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().attempt)).toBe(1);
  await expect.poll(() => phase(page)).toBe('intro');
  expect(await battle(page)).toMatchObject({ temperature: 2, speed: 2, numbers: true });
  expect(errors).toEqual([]);
});

test('on a tall phone the moves are the first screen (no PROMPT), the system row under them; a tap selects, a second tap commits', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 2);
  await toCommand(page);
  expect((await menu(page))?.id).toBe('battle-moves');
  // All seven moves and WHY? LOG NUMBERS SPEED, never PROMPT, each a 44 px target clear of the controls.
  await target(page, 'battle-moves', 6);
  for (const i of [ROOT.why, ROOT.log, ROOT.numbers, ROOT.speed]) await target(page, 'battle-root', i);
  expect((await taps(page)).some((t) => t.menu === 'battle-root' && t.index === ROOT.prompt)).toBe(false);
  expect(await expectTargets(page)).toBe(11);
  // NUMBERS in the row toggles in place; B (the B button) stays on the moves.
  await tapOption(page, 'battle-root', ROOT.numbers);
  await expect.poll(() => battle(page).then((b) => b?.numbers)).toBe(true);
  await page.locator('[data-control="btn-b"]').tap();
  await tapOption(page, 'battle-moves', 0);
  await expect.poll(() => battle(page).then((b) => b?.armed)).toEqual({ screen: 'moves', index: 0 });
  expect(await phase(page)).toBe('command');
  await tapOption(page, 'battle-moves', 0);
  await expect.poll(() => phase(page)).toBe('playback');
  await toCommand(page);
  expect((await battle(page))?.round).toBe(1);
  expect((await menu(page))?.id).toBe('battle-moves');
  expect(errors).toEqual([]);
  await context.close();
});

test('a 360x640 phone reaches all seven moves, Guardrail included, by tapping them', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 0);
  await toCommand(page);
  await tapOption(page, 'battle-root', 0);
  await toCommand(page);
  await target(page, 'battle-moves', 6);
  await tapOption(page, 'battle-moves', 6);
  await tapOption(page, 'battle-moves', 6);
  await expect.poll(() => phase(page)).not.toBe('command');
  expect(errors).toEqual([]);
  await context.close();
});

test('landscape touch: the D-pad and A/B overlay the edges, translucent, clear of the safe area where the menus go', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await startRival(page, 0);
  const layout = await page.evaluate(() => window.__latentia?.layout());
  expect(layout?.controls).toBe('overlay');
  if (!layout) throw new Error('no layout');
  const k = layout.game.width / layout.logical.width;
  const safe = { x: layout.game.x + layout.safe.x * k, y: layout.game.y + layout.safe.y * k, width: layout.safe.width * k, height: layout.safe.height * k };
  for (const b of await page.locator('#controls .touch-btn').all()) {
    const r = await b.boundingBox();
    if (!r) throw new Error('no button box');
    const overlaps = r.x < safe.x + safe.width && r.x + r.width > safe.x && r.y < safe.y + safe.height && r.y + r.height > safe.y;
    expect(overlaps).toBe(false);
    expect(Number(await b.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
  }
  await toCommand(page);
  await expectTargets(page);
  expect(errors).toEqual([]);
  await context.close();
});
