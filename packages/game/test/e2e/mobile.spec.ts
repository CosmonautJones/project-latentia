// The P5 mobile pass on a 390x844 phone (DPR 3, touch): every control is a 44 CSS px target in both orientations,
// rotating mid-battle or mid-dialogue keeps the state (no lost focus, no stuck two-tap), and the frame rate holds on
// the overworld and in battle. The fps numbers are printed for the report.

import { expect, test, type Browser, type Page } from '@playwright/test';
import { battle, menu, panel, pick, scene, send, watchErrors } from './drive.js';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

async function phone(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: PORTRAIT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

const phase = async (page: Page) => (await battle(page))?.phase ?? null;
const layoutMenus = (page: Page) => page.evaluate(() => window.__latentia?.layout().menus ?? null);
const controls = (page: Page) => page.evaluate(() => window.__latentia?.layout().controls ?? null);

async function toRival(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await send(page, { type: 'newGame' });
  await send(page, { type: 'starterPicked', starter: 'sagelet' });
  await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('rival');
}

async function toCommand(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const p = await phase(page);
        if (p === 'intro' || p === 'hint' || p === 'why') await page.evaluate(() => window.__latentia?.press('a'));
        return p;
      },
      { timeout: 20_000 },
    )
    .toBe('command');
}

/** Every visible band button and touch control is at least 44x44 CSS px and inside the viewport. */
async function expectTargets(page: Page, size: { width: number; height: number }): Promise<number> {
  const boxes = await page.locator('#band-panel button:visible, #controls .touch-btn:visible').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, right: r.right, left: r.left, label: el.getAttribute('data-menu') ?? el.getAttribute('data-control') };
    }),
  );
  for (const b of boxes) {
    expect(b.h, `${b.label} height`).toBeGreaterThanOrEqual(44);
    expect(b.w, `${b.label} width`).toBeGreaterThanOrEqual(44);
    expect(b.left, `${b.label} left`).toBeGreaterThanOrEqual(0);
    expect(b.right, `${b.label} right`).toBeLessThanOrEqual(size.width);
  }
  return boxes.length;
}

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

test('the title, a choice panel and the battle menu have 44 px targets in portrait and touch landscape', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  expect(await layoutMenus(page)).toBe('band');
  await expect(page.locator('#band-panel [data-menu="title"]')).toHaveCount(1);
  expect(await expectTargets(page, PORTRAIT)).toBeGreaterThan(6);
  await page.setViewportSize(LANDSCAPE);
  await expect.poll(() => controls(page)).toBe('sides');
  expect(await layoutMenus(page)).toBe('band');
  await expect(page.locator('#band-panel [data-menu="title"]')).toHaveCount(1);
  await expectTargets(page, LANDSCAPE);
  // The band's NEW GAME button starts the game.
  await page.locator('#band-panel [data-menu="title"][data-index="0"]').click();
  await expect.poll(() => scene(page)).toBe('Overworld');
  await send(page, { type: 'starterPicked', starter: 'sagelet' });
  await toCommand(page);
  await expect(page.locator('#band-panel [data-menu="battle-root"]')).toHaveCount(5);
  await expectTargets(page, LANDSCAPE);
  await page.locator('#band-panel [data-menu="battle-root"][data-index="0"]').click();
  await toCommand(page);
  await expect(page.locator('#band-panel [data-menu="battle-moves"]')).toHaveCount(7);
  await expectTargets(page, LANDSCAPE);
  expect(errors).toEqual([]);
  await close();
});

test('rotating mid-battle keeps the menu, the armed move and keyboard input; the second tap still commits', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await toRival(page);
  // Rotate during the intro dialogue: it is still up, and A still advances it.
  expect(await phase(page)).toBe('intro');
  await page.setViewportSize(LANDSCAPE);
  await expect.poll(() => controls(page)).toBe('sides');
  expect(await phase(page)).toBe('intro');
  await toCommand(page);
  await page.setViewportSize(PORTRAIT);
  await expect.poll(() => controls(page)).toBe('band');
  await pick(page, 'battle-root', 0);
  await toCommand(page);
  // First tap arms Compact (index 4), then rotate: still armed, still on the moves, and still exactly one armed row.
  await pick(page, 'battle-moves', 4);
  await expect(page.locator('#band-panel .band-btn.armed')).toHaveCount(1);
  await page.setViewportSize(LANDSCAPE);
  await expect.poll(() => controls(page)).toBe('sides');
  expect(await menu(page)).toMatchObject({ id: 'battle-moves', index: 4 });
  await expect(page.locator('#band-panel .band-btn.armed')).toHaveCount(1);
  await expect(page.locator('#band-panel [data-menu="battle-moves"][data-index="4"].armed')).toHaveCount(1);
  // Keys still reach the game after the rotation: B backs out to the root, Enter opens the moves again.
  await page.keyboard.press('KeyX');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-root');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
  // Two taps on a band button commit, in the new orientation.
  const compact = page.locator('#band-panel [data-menu="battle-moves"][data-index="4"]');
  await compact.click();
  await compact.click();
  await expect.poll(() => phase(page)).toBe('playback');
  await page.setViewportSize(PORTRAIT);
  await toCommand(page);
  expect((await battle(page))?.round).toBe(1);
  expect(errors).toEqual([]);
  await close();
});

test('rotating with a choice panel open keeps the cursor and shows the choices once, in the band', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const errors = watchErrors(page);
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  for (const e of [{ type: 'newGame' }, { type: 'starterPicked', starter: 'blitzr' }, { type: 'battleWon' }, { type: 'reachedTrailhead' }, { type: 'battleWon' }] as const) {
    expect(await send(page, e)).toBe(true);
  }
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('distill');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => menu(page).then((m) => m?.index)).toBe(1);
  const buttons = page.locator('#band-panel [data-menu="distill"]');
  await expect(buttons).toHaveCount(2);
  // Each button carries the label and its detail line.
  await expect(buttons.nth(1).locator('.detail')).toHaveCount(1);
  await page.setViewportSize(LANDSCAPE);
  await expect.poll(() => controls(page)).toBe('sides');
  await expect(buttons).toHaveCount(2);
  await expect(page.locator('#band-panel [data-menu="distill"].cursor')).toHaveAttribute('data-index', '1');
  expect((await menu(page))?.index).toBe(1);
  // Rotating back and forth never stacks a second set of buttons.
  await page.setViewportSize(PORTRAIT);
  await expect.poll(() => controls(page)).toBe('band');
  await page.setViewportSize(LANDSCAPE);
  await expect.poll(() => controls(page)).toBe('sides');
  await expect(buttons).toHaveCount(2);
  expect((await panel(page))?.id).toBe('distill');
  await buttons.nth(0).click();
  await expect.poll(() => page.evaluate(() => window.__latentia?.flow().distill ?? null)).toBe('spinUp');
  expect(errors).toEqual([]);
  await close();
});

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
  await toCommand(page);
  await pick(page, 'battle-root', 0);
  await toCommand(page);
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
