// The mobile pass on a 390x844 phone (DPR 3, touch), and v0.1's other review sizes: every menu option is drawn in the
// game image and tapped there, every option and control is a 44 CSS px target clear of the others in both
// orientations, and the frame rate holds (the fps numbers are printed for the report). Rotation: rotation.spec.ts.

import { expect, test, type Page } from '@playwright/test';
import { battle, expectTargets, LANDSCAPE, logical, menu, panel, phone, pick, PORTRAIT, rotate, scene, send, tapOption, target, toRival, untilCommand, watchErrors } from './drive.js';

test('the title, a choice panel and the battle menus are tapped in the image, 44 px targets in portrait and touch landscape', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  expect(await logical(page)).toEqual({ width: 270, height: 540 });
  await target(page, 'title', 0);
  expect(await expectTargets(page)).toBe(1);
  await rotate(page, LANDSCAPE);
  expect(await logical(page)).toEqual({ width: 480, height: 270 });
  await target(page, 'title', 0);
  await expectTargets(page);
  // A real tap on NEW GAME, drawn in the game image, starts the game.
  await tapOption(page, 'title', 0);
  await expect.poll(() => scene(page)).toBe('Overworld');
  await send(page, { type: 'starterPicked', starter: 'sagelet' });
  await untilCommand(page);
  await target(page, 'battle-root', 4);
  expect(await expectTargets(page)).toBe(5);
  await tapOption(page, 'battle-root', 0);
  await untilCommand(page);
  await target(page, 'battle-moves', 6);
  expect(await expectTargets(page)).toBe(7);
  await rotate(page, PORTRAIT);
  await target(page, 'battle-moves', 6);
  expect(await expectTargets(page)).toBe(7);
  expect(errors).toEqual([]);
  await close();
});

for (const v of [
  { name: '360x640 at DPR 3', viewport: { width: 360, height: 640 }, dpr: 3 },
  { name: '360x640 at DPR 2', viewport: { width: 360, height: 640 }, dpr: 2 },
  { name: '640x360 at DPR 3', viewport: { width: 640, height: 360 }, dpr: 3 },
]) {
  test(`${v.name}: the starter panel and the move list fit, every option a 44 px target clear of the controls`, async ({ browser }) => {
    const { page, close } = await phone(browser, v.viewport, v.dpr);
    const errors = watchErrors(page);
    await page.goto('/');
    await expect.poll(() => scene(page)).toBe('Title');
    await send(page, { type: 'newGame' });
    await expect
      .poll(async () => {
        if ((await menu(page))?.id === 'starter') return true;
        await page.evaluate(() => window.__latentia?.press('a'));
        return false;
      })
      .toBe(true);
    await target(page, 'starter', 2);
    expect(await expectTargets(page)).toBe(3);
    await tapOption(page, 'starter', 0);
    await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('rival');
    await untilCommand(page);
    await tapOption(page, 'battle-root', 0);
    await untilCommand(page);
    await target(page, 'battle-moves', 6);
    expect(await expectTargets(page)).toBe(7);
    expect(errors).toEqual([]);
    await close();
  });
}

test('with a save, NEW GAME in the image asks first: one tap never writes, a second tap cancels, START OVER resets', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  const raw = () => page.evaluate(() => window.localStorage.getItem('latentia.save.v0'));
  await toRival(page);
  await send(page, { type: 'battleWon' });
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().step)).toBe('walk');
  await page.reload();
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title', items: ['CONTINUE', 'NEW GAME'] });
  const before = await raw();
  expect(JSON.parse(before ?? 'null')).toMatchObject({ progress: { step: 'walk', starter: 'sagelet' } });
  // Count every write from here on.
  await page.evaluate(() => {
    const w = window as unknown as { __writes: number };
    w.__writes = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      w.__writes++;
      set.call(this, k, v);
    };
  });
  const writes = () => page.evaluate(() => (window as unknown as { __writes: number }).__writes);

  // One tap: the confirm panel, the cursor on CANCEL, 44 px targets, nothing written, the title menu gone.
  await tapOption(page, 'title', 1);
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title-confirm', items: ['START OVER', 'CANCEL'], index: 1 });
  expect(await panel(page)).toMatchObject({ title: 'START OVER?', body: ['Your saved run will be erased.'] });
  await target(page, 'title-confirm', 1);
  expect((await page.evaluate(() => window.__latentia?.taps() ?? [])).map((t) => t.menu)).toEqual(['title-confirm', 'title-confirm']);
  await expectTargets(page);
  expect(await writes()).toBe(0);

  // CANCEL: back to the title, the save untouched.
  await tapOption(page, 'title-confirm', 1);
  await expect.poll(() => menu(page)).toMatchObject({ id: 'title', items: ['CONTINUE', 'NEW GAME'] });
  expect(await scene(page)).toBe('Title');
  // B backs out too.
  await tapOption(page, 'title', 1);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title-confirm');
  await page.locator('[data-control="btn-b"]').tap();
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('title');
  expect(await writes()).toBe(0);
  expect(await raw()).toBe(before);

  // START OVER erases the run: a fresh lab.
  await tapOption(page, 'title', 1);
  await tapOption(page, 'title-confirm', 0);
  await expect.poll(() => scene(page)).toBe('Overworld');
  expect(JSON.parse((await raw()) ?? 'null')).toMatchObject({ progress: { step: 'lab', starter: null }, hintsSeen: [] });
  expect(errors).toEqual([]);
  await close();
});

/** Frames per second over `ms`, from requestAnimationFrame, plus the slowest frame. */
async function measureFps(page: Page, ms: number): Promise<{ fps: number; worstMs: number }> {
  return page.evaluate(
    (duration) =>
      new Promise<{ fps: number; worstMs: number }>((resolve) => {
        let frames = 0;
        let worst = 0;
        const start = performance.now();
        let last = start;
        const tick = (now: number) => {
          frames++;
          worst = Math.max(worst, now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(tick);
          else resolve({ fps: Math.round((frames * 1000 * 10) / (now - start)) / 10, worstMs: Math.round(worst * 10) / 10 });
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

test('the frame rate holds on a 390x844 phone: walking the overworld and playing a battle round', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  // CPU_THROTTLE=4 slows the CPU like a mid-range phone (Chrome DevTools); the numbers are then printed, not asserted.
  const throttle = Number(process.env['CPU_THROTTLE'] ?? 1);
  if (throttle > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  for (const e of [{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }, { type: 'battleWon' }] as const) expect(await send(page, e)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.overworld()?.mode ?? null)).toBe('walk');
  // Hold down on the D-pad: the player walks (and the camera follows) the whole time we measure.
  const pad = await page.locator('[data-control="dpad-down"]').boundingBox();
  if (!pad) throw new Error('no d-pad');
  await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
  await page.mouse.down();
  const overworld = await measureFps(page, 2000);
  await page.mouse.up();
  await send(page, { type: 'reachedTrailhead' });
  await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('wild');
  await untilCommand(page);
  await pick(page, 'battle-root', 0);
  await untilCommand(page);
  await pick(page, 'battle-moves', 0);
  const fight = measureFps(page, 1500);
  await pick(page, 'battle-moves', 0);
  const battleFps = await fight;
  console.log(`fps (390x844, DPR 3, mobile emulation, CPU x${throttle}): overworld ${overworld.fps} (worst frame ${overworld.worstMs} ms), battle ${battleFps.fps} (worst frame ${battleFps.worstMs} ms)`);
  if (throttle === 1) {
    expect(overworld.fps).toBeGreaterThanOrEqual(55);
    expect(battleFps.fps).toBeGreaterThanOrEqual(55);
  }
  expect(errors).toEqual([]);
  await close();
});
