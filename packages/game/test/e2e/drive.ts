// Shared e2e helpers for the journey: read the hook, close dialogue, and play a battle as the scripted naive player
// of scripts/loop-balance.ts does (the strongest affordable damaging move at T2, Compact when nothing fits), so a
// seeded fight in the browser ends the way the measurement says it does.

import { expect, type Browser, type Page } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';
import type { FlowEvent } from '../../src/flow/flow.js';

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export const scene = (page: Page) => page.evaluate(() => window.__latentia?.scene() ?? null);
export const flow = (page: Page) => page.evaluate(() => window.__latentia?.flow() ?? null);
export const menu = (page: Page) => page.evaluate(() => window.__latentia?.menu() ?? null);
export const panel = (page: Page) => page.evaluate(() => window.__latentia?.panel() ?? null);
export const battle = (page: Page) => page.evaluate(() => window.__latentia?.battle() ?? null);
export const send = (page: Page, e: FlowEvent) => page.evaluate((ev) => window.__latentia?.send(ev), e);
export const pick = (page: Page, menuId: string, i: number) => page.evaluate(([m, n]) => window.__latentia?.pick(m as string, n as number), [menuId, i] as const);

/** Press A (through dialogue) until the menu `id` has the cursor. */
export async function untilMenu(page: Page, id: string): Promise<void> {
  await expect
    .poll(
      async () => {
        if ((await menu(page))?.id === id) return true;
        await page.evaluate(() => window.__latentia?.press('a'));
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}


/** Close dialogue (intro, hints) until the command menu is up or the battle is over. */
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

/** Tap twice: the first tap selects, the second commits (two-tap). */
const commit = async (page: Page, menuId: string, i: number) => {
  await pick(page, menuId, i);
  await pick(page, menuId, i);
};

/** Play the battle on screen to its result, naive-player style, at 2×. Returns the outcome. */
export async function playNaive(page: Page): Promise<string> {
  await toCommand(page);
  if ((await battle(page))?.speed !== 2) await pick(page, 'battle-root', 4);
  for (let i = 0; i < 60 && (await phase(page)) === 'command'; i++) {
    await pick(page, 'battle-root', 0);
    await toCommand(page);
    await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
    const moves = (await battle(page))?.moves ?? [];
    let best = -1;
    moves.forEach((m, j) => {
      if (m.damaging && m.affordable && (best < 0 || (m.power ?? 0) > (moves[best]?.power ?? 0))) best = j;
    });
    await commit(page, 'battle-moves', best >= 0 ? best : moves.findIndex((m) => m.moveId === 'compact'));
    if ((await menu(page))?.id === 'battle-targets') await commit(page, 'battle-targets', 0);
    await toCommand(page);
  }
  const outcome = (await battle(page))?.result?.outcome;
  expect(outcome).toBeDefined();
  return outcome ?? '';
}

/** Close the battle's result line until the flow leaves step `from`. */
export async function leaveBattle(page: Page, from: string): Promise<void> {
  await expect
    .poll(async () => {
      const f = await flow(page);
      if (f?.step === from) await page.evaluate(() => window.__latentia?.press('a'));
      return f?.step !== from;
    })
    .toBe(true);
}

export interface Target {
  readonly menu: string;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Every option tappable in the game image now, in page CSS px (the hook's `taps()`). */
export const taps = (page: Page): Promise<Target[]> => page.evaluate(() => window.__latentia?.taps() ?? []);

/** Tap a drawn option where it is: a real touch at its centre (a click without touch). */
async function tapAt(page: Page, t: Target): Promise<void> {
  const touch = await page.evaluate(() => window.__latentia?.layout().controls === 'overlay');
  if (touch) await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
  else await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2);
}

/**
 * Wait until option `index` of menu `menuId` is drawn, and return where. A move on another page of a long move list is
 * reached the way a player does: by tapping MORE until its page shows.
 */
export async function target(page: Page, menuId: string, index: number): Promise<Target> {
  let found: Target | undefined;
  await expect
    .poll(async () => {
      const all = await taps(page);
      found = all.find((t) => t.menu === menuId && t.index === index);
      const more = all.find((t) => t.menu === 'battle-page');
      if (found === undefined && menuId === 'battle-moves' && more !== undefined) await tapAt(page, more);
      return found !== undefined;
    }, { message: `${menuId}[${index}] is drawn` })
    .toBe(true);
  return found as Target;
}

/** Tap option `index` of menu `menuId` where it is drawn: a real touch at its centre (a click without touch). */
export async function tapOption(page: Page, menuId: string, index: number): Promise<void> {
  await tapAt(page, await target(page, menuId, index));
}

/**
 * Every in-image option and every touch control is at least 44x44 CSS px and on screen, and no control covers an
 * option. Returns how many options there are.
 */
export async function expectTargets(page: Page): Promise<number> {
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  const options = await taps(page);
  const controls = await page.locator('#controls .touch-btn:visible').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { menu: el.getAttribute('data-control') ?? '?', index: -1, x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  for (const b of [...options, ...controls]) {
    const label = `${b.menu}[${b.index}]`;
    expect(b.height, `${label} height`).toBeGreaterThanOrEqual(44 - 1e-6);
    expect(b.width, `${label} width`).toBeGreaterThanOrEqual(44 - 1e-6);
    expect(b.x, `${label} left`).toBeGreaterThanOrEqual(-1e-6);
    expect(b.y, `${label} top`).toBeGreaterThanOrEqual(-1e-6);
    expect(b.x + b.width, `${label} right`).toBeLessThanOrEqual(size.width + 1e-6);
    expect(b.y + b.height, `${label} bottom`).toBeLessThanOrEqual(size.height + 1e-6);
  }
  for (const o of options) {
    for (const c of controls) {
      const hit = o.x < c.x + c.width && c.x < o.x + o.width && o.y < c.y + c.height && c.y < o.y + o.height;
      expect(hit, `${c.menu} covers ${o.menu}[${o.index}]`).toBe(false);
    }
  }
  return options.length;
}

export const PORTRAIT = { width: 390, height: 844 };
export const LANDSCAPE = { width: 844, height: 390 };

/** A 390x844 touch phone at DPR 3 (or the viewport and DPR given). */
export async function phone(browser: Browser, viewport = PORTRAIT, deviceScaleFactor = 3): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

export const phase = async (page: Page) => (await battle(page))?.phase ?? null;
const mode = (page: Page) => page.evaluate(() => window.__latentia?.layout().mode ?? null);
export const logical = (page: Page) => page.evaluate(() => window.__latentia?.layout().logical ?? null);

/** Rotate, and wait until the game has been resized for the new orientation. */
export async function rotate(page: Page, to: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(to);
  const want = to.width > to.height ? 'landscape' : 'portrait';
  await expect.poll(() => mode(page)).toBe(want);
  await expect.poll(() => page.evaluate(() => [window.__latentia?.layout().logical.width, document.querySelector('#frame canvas')?.getAttribute('width')]).then(([a, b]) => String(a) === b)).toBe(true);
}

export async function toRival(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await send(page, { type: 'newGame' });
  await send(page, { type: 'starterPicked', starter: 'sagelet' });
  await expect.poll(() => battle(page).then((b) => b?.id ?? null)).toBe('rival');
}

export async function untilCommand(page: Page): Promise<void> {
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


/**
 * Open the move list: tap PROMPT, or nothing on a tall portrait screen, where the moves are already the first screen
 * (direct mode). Closes a first-visit hint.
 */
export async function openMoves(page: Page): Promise<void> {
  if ((await menu(page))?.id !== 'battle-moves') await tapOption(page, 'battle-root', 0);
  await untilCommand(page);
  await expect.poll(() => menu(page).then((m) => m?.id)).toBe('battle-moves');
}

/** Whether option `index` of `menuId` is drawn right now, wholly inside the viewport (no paging to find it). */
export async function drawnOnScreen(page: Page, menuId: string, index: number): Promise<boolean> {
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  const t = (await taps(page)).find((o) => o.menu === menuId && o.index === index);
  return t !== undefined && t.x >= 0 && t.y >= 0 && t.x + t.width <= size.width + 1e-6 && t.y + t.height <= size.height + 1e-6;
}
