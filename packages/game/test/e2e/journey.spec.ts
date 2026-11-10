// The whole v0 journey through the dev hook, to the end card, on both distill paths (plan task P4). The spin-up run
// plays the core loop for real on the engine: Blitzr with the bad card loses to Bootcamp Grad on seed 0, the debrief
// says what Tokenibble kept doing, a card swap starts the rematch on seed 1, and the good card wins it
// (scripts/loop-balance.ts measures exactly these fights). The graft run goes through its own debrief. Saves are
// checked at each step, and Continue resumes the debrief. Any console error fails.

import { expect, test, type Page } from '@playwright/test';
import { flow, leaveBattle, menu, panel, pick, playNaive, scene, send, untilMenu, watchErrors } from './drive.js';

const save = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('latentia.save.v0') ?? 'null'));

/** Title → the lab: Prof. Epoch's intro, then the starter panel; pick `starter` → the rival battle → won via the hook. */
async function throughTheRival(page: Page, starterIndex: number): Promise<void> {
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await send(page, { type: 'newGame' });
  await expect.poll(() => page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null)).toMatch(/^PROF\. EPOCH: /);
  await untilMenu(page, 'starter');
  expect((await panel(page))?.items.map((i) => i.label)).toEqual(['SAGELET   Reasoning', 'BLITZR    Speed', 'FORKLING  Open']);
  expect((await panel(page))?.items.every((i) => (i.detail ?? '').length > 0)).toBe(true);
  await pick(page, 'starter', starterIndex);
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('rival');
  expect(await send(page, { type: 'battleWon' })).toBe(true);
  await expect.poll(() => scene(page)).toBe('Overworld');
  expect(await send(page, { type: 'reachedTrailhead' })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('wild');
  expect(await send(page, { type: 'battleWon' })).toBe(true);
  await expect.poll(() => scene(page)).toBe('Distill');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('distill');
  expect((await panel(page))?.items.map((i) => i.label)).toEqual(['SPIN UP  (recommended)', 'GRAFT']);
}

test('spin-up: lab → rival → wild → distill → card tutorial → Bootcamp Grad lost → swap → rematch won → end card', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await throughTheRival(page, 1);
  expect(await save(page)).toMatchObject({ schemaVersion: 3, progress: { step: 'distill', starter: 'blitzr' } });

  await pick(page, 'distill', 0);
  await expect.poll(() => page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null)).toMatch(/^CARDS: /);
  await untilMenu(page, 'tutorial-card');
  expect((await panel(page))?.items.map((i) => i.label)).toEqual(['IF foe HP < 50% THEN Early Exit', 'ALWAYS Early Exit', 'IF own HP >= 50% THEN Low Latency']);
  // Teach the bad card: stretch while healthy.
  await pick(page, 'tutorial-card', 2);
  await expect.poll(() => flow(page).then((f) => f?.step)).toBe('forest');
  expect(await save(page)).toMatchObject({ progress: { step: 'forest', distill: 'spinUp', tutorialCardId: 'tutorial.c' }, hintsSeen: expect.arrayContaining(['tutorial.cards']) });

  // Bootcamp Grad, seed 0: the bad card loses.
  expect(await send(page, { type: 'trainerEngaged' })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('trainer');
  expect(await playNaive(page)).toBe('lose');
  await leaveBattle(page, 'trainer');
  await expect.poll(() => scene(page)).toBe('Debrief');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  const loss = await panel(page);
  expect(loss?.title).toBe('TOKENIBBLE KEPT...');
  expect(loss?.body[0]).toMatch(/^Tokenibble kept using Low Latency: \d+ of \d+ turns/);
  expect(loss?.items.map((i) => i.label)).toEqual(['SWAP ITS CARD, THEN REMATCH', 'REMATCH AS IS']);
  expect(await save(page)).toMatchObject({ progress: { step: 'debrief', lastFight: { outcome: 'lose', cardId: 'tutorial.c' }, telemetry: { losses: 1 } } });

  // Continue resumes the debrief with the same panel.
  await page.reload();
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  expect((await panel(page))?.body).toEqual(loss?.body);

  // Swap: the picker marks the taught card; B goes back; then teach Early Exit and rematch.
  await pick(page, 'debrief', 0);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('swap-card');
  expect((await panel(page))?.items[2]?.label).toBe('IF own HP >= 50% THEN Low Latency (TAUGHT)');
  await page.evaluate(() => window.__latentia?.press('b'));
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  await pick(page, 'debrief', 0);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('swap-card');
  await pick(page, 'swap-card', 1);
  await expect.poll(() => flow(page)).toMatchObject({ step: 'trainer', tutorialCardId: 'tutorial.b', attempt: 1, telemetry: { losses: 1, swaps: 1, rematches: 1 } });

  // The rematch, seed 1: the good card wins.
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('trainer');
  expect(await playNaive(page)).toBe('win');
  await leaveBattle(page, 'trainer');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  expect((await panel(page))?.title).toBe('YOU BEAT BOOTCAMP GRAD');
  expect((await panel(page))?.items.map((i) => i.label)).toEqual(['ON TO THE END', 'TRY A DIFFERENT CARD?']);
  await pick(page, 'debrief', 0);

  await expect.poll(() => scene(page)).toBe('End');
  const end = await flow(page);
  expect(end?.telemetry).toMatchObject({ losses: 1, swaps: 1, rematches: 1 });
  expect(end?.telemetry.fights.filter((f) => f.battle === 'trainer').map((f) => [f.outcome, f.cardId])).toEqual([
    ['lose', 'tutorial.c'],
    ['win', 'tutorial.b'],
  ]);
  expect(end?.telemetry.cardsFired).toBeGreaterThan(0);
  expect(await save(page)).toMatchObject({ progress: { step: 'end', trainerBeaten: true } });
  expect((await menu(page))?.id).toBe('end');
  // The end card persists: back to the title, Continue shows it again.
  await pick(page, 'end', 0);
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title', items: ['CONTINUE', 'NEW GAME'] });
  await pick(page, 'title', 0);
  await expect.poll(() => scene(page)).toBe('End');
  expect(errors).toEqual([]);
});

test('graft: distill → forest → Bootcamp Grad → debrief with the graft hint → rematch → end card', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await throughTheRival(page, 0);
  await pick(page, 'distill', 1);
  await expect.poll(() => flow(page)).toMatchObject({ step: 'forest', distill: 'graft', tutorialCardId: null });
  expect(await send(page, { type: 'trainerEngaged' })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('trainer');
  // The grafted orchestrator's moves come from its grid: Token Nibble is among them.
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.moves.map((m) => m.moveId) ?? [])).toContain('token-nibble');

  // A loss (forced through the hook) gets the grafted-move hint and a rematch, with no card to swap.
  expect(await send(page, { type: 'battleLost' })).toBe(true);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  expect((await panel(page))?.title).toBe('ABOUT YOUR GRAFT...');
  expect((await panel(page))?.items.map((i) => i.label)).toEqual(['REMATCH']);
  await pick(page, 'debrief', 0);
  await expect.poll(() => flow(page)).toMatchObject({ step: 'trainer', attempt: 1, telemetry: { losses: 1, swaps: 0, rematches: 1 } });

  // The rematch played for real (Sagelet on seed 1), to its debrief.
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('trainer');
  const outcome = await playNaive(page);
  await leaveBattle(page, 'trainer');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('debrief');
  const after = await panel(page);
  if (outcome !== 'win') throw new Error(`expected the graft rematch to win (Sagelet, seed 1), got ${outcome}`);
  expect(after?.title).toBe('YOU BEAT BOOTCAMP GRAD');
  expect(after?.body[0]).toMatch(/Token Nibble/);
  await pick(page, 'debrief', 0);
  await expect.poll(() => scene(page)).toBe('End');
  expect(await flow(page)).toMatchObject({ distill: 'graft', trainerBeaten: true });
  expect(errors).toEqual([]);
});
