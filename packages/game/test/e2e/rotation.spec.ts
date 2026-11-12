// Rotating a phone mid-battle, mid-two-tap, mid-playback, mid-panel and mid-dialogue (plan v0.1 Review Focus 1): the
// game resizes to the new logical size, the state is kept, nothing stacks twice, and taps and keys still work.

import { expect, test } from '@playwright/test';
import { battle, expectTargets, LANDSCAPE, menu, panel, phase, phone, PORTRAIT, rotate, scene, send, tapOption, target, toRival, untilCommand, watchErrors } from './drive.js';

test('rotating mid-battle keeps the menu, the armed move and keyboard input; the second tap still commits', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await toRival(page);
  // Rotate during the intro dialogue: it is still up, and A still advances it.
  expect(await phase(page)).toBe('intro');
  await rotate(page, LANDSCAPE);
  expect(await phase(page)).toBe('intro');
  await untilCommand(page);
  await rotate(page, PORTRAIT);
  await tapOption(page, 'battle-root', 0);
  await untilCommand(page);
  // First tap arms Compact (index 4), then rotate: still armed, still on the moves, and its button is drawn again.
  await tapOption(page, 'battle-moves', 4);
  await expect.poll(() => battle(page).then((b) => b?.armed)).toEqual({ screen: 'moves', index: 4 });
  await rotate(page, LANDSCAPE);
  expect(await menu(page)).toMatchObject({ id: 'battle-moves', index: 4 });
  expect((await battle(page))?.armed).toEqual({ screen: 'moves', index: 4 });
  await target(page, 'battle-moves', 4);
  await expectTargets(page);
  // Keys still reach the game after the rotation: B backs out to the root, Enter opens the moves again.
  await page.keyboard.press('KeyX');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-root');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
  // Two taps on the drawn button commit, in the new orientation.
  await tapOption(page, 'battle-moves', 4);
  await expect.poll(() => battle(page).then((b) => b?.armed)).toEqual({ screen: 'moves', index: 4 });
  await tapOption(page, 'battle-moves', 4);
  await expect.poll(() => phase(page)).toBe('playback');
  // Rotating mid-playback keeps the round going.
  await rotate(page, PORTRAIT);
  await untilCommand(page);
  expect((await battle(page))?.round).toBe(1);
  expect(errors).toEqual([]);
  await close();
});


test('rotating with a choice panel open keeps the cursor and draws the choices once', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  for (const e of [{ type: 'newGame' }, { type: 'starterPicked', starter: 'blitzr' }, { type: 'battleWon' }, { type: 'reachedTrailhead' }, { type: 'battleWon' }] as const) {
    expect(await send(page, e)).toBe(true);
  }
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('distill');
  await page.locator('[data-control="dpad-down"]').tap();
  await expect.poll(() => menu(page).then((m) => m?.index)).toBe(1);
  const distillTargets = async () => (await page.evaluate(() => window.__latentia?.taps() ?? [])).filter((t) => t.menu === 'distill').length;
  expect(await distillTargets()).toBe(2);
  await rotate(page, LANDSCAPE);
  expect(await distillTargets()).toBe(2);
  expect((await menu(page))?.index).toBe(1);
  // Rotating back and forth never stacks a second set of options.
  await rotate(page, PORTRAIT);
  await rotate(page, LANDSCAPE);
  expect(await distillTargets()).toBe(2);
  await expectTargets(page);
  expect((await panel(page))?.id).toBe('distill');
  await tapOption(page, 'distill', 0);
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().distill ?? null)).toBe('spinUp');
  expect(errors).toEqual([]);
  await close();
});


test('rotating mid-dialogue in the overworld keeps the line on screen, and A still turns it', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await send(page, { type: 'newGame' });
  await expect.poll(() => page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null)).not.toBeNull();
  const line = await page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null);
  await rotate(page, LANDSCAPE);
  expect(await page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null)).toBe(line);
  await rotate(page, PORTRAIT);
  expect(await page.evaluate(() => window.__latentia?.overworld()?.dialogue ?? null)).toBe(line);
  // A tap anywhere on the image counts as A.
  await expect
    .poll(async () => {
      if ((await menu(page))?.id === 'starter') return true;
      await page.touchscreen.tap(195, 300);
      return false;
    }, { timeout: 20_000 })
    .toBe(true);
  expect(errors).toEqual([]);
  await close();
});

