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
