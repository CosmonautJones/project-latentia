// Shared e2e helpers for the journey: read the hook, close dialogue, and play a battle as the scripted naive player
// of scripts/loop-balance.ts does (the strongest affordable damaging move at T2, Compact when nothing fits), so a
// seeded fight in the browser ends the way the measurement says it does.

import { expect, type Page } from '@playwright/test';
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

const phase = async (page: Page) => (await battle(page))?.phase ?? null;

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

/** Wait until option `index` of menu `menuId` is drawn, and return where. */
export async function target(page: Page, menuId: string, index: number): Promise<Target> {
  let found: Target | undefined;
  await expect
    .poll(async () => {
      found = (await taps(page)).find((t) => t.menu === menuId && t.index === index);
      return found !== undefined;
    }, { message: `${menuId}[${index}] is drawn` })
    .toBe(true);
  return found as Target;
}

/** Tap option `index` of menu `menuId` where it is drawn: a real touch at its centre (a click without touch). */
export async function tapOption(page: Page, menuId: string, index: number): Promise<void> {
  const t = await target(page, menuId, index);
  const x = t.x + t.width / 2;
  const y = t.y + t.height / 2;
  const touch = await page.evaluate(() => window.__latentia?.layout().controls === 'overlay');
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
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
