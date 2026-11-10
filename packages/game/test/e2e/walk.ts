// Shared e2e helpers for the overworld: read the probe, and walk the real map with real input (keyboard, or the
// touch D-pad), one tile per tap. Routes come from the map data through the same pure BFS the map tests use.

import { expect, type Page } from '@playwright/test';
// Brings in the global `window.__latentia` typing.
import type {} from '../../src/dev/hook.js';
import { LOCALHOST } from '../../src/content/maps/localhost.js';
import type { Dir } from '../../src/overworld/direction.js';
import type { Place } from '../../src/overworld/map.js';
import type { OverworldProbe } from '../../src/overworld/probe.js';
import { route } from '../../src/overworld/reach.js';

export const ow = (page: Page): Promise<OverworldProbe | null> => page.evaluate(() => window.__latentia?.overworld() ?? null);

const KEYS: Readonly<Record<Dir, string>> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

export type Pad = 'keyboard' | 'touch';

async function hold(page: Page, d: Dir, pad: Pad, down: boolean): Promise<void> {
  if (pad === 'keyboard') {
    await (down ? page.keyboard.down(KEYS[d]) : page.keyboard.up(KEYS[d]));
    return;
  }
  if (down) {
    const box = await page.locator(`[data-control="dpad-${d}"]`).boundingBox();
    if (!box) throw new Error(`no dpad-${d}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  } else {
    await page.mouse.up();
  }
}

/**
 * One tap of a direction: hold it until a step starts (or the player turns and steps), let go, and wait for the step
 * and any warp to finish. Releasing mid-step still completes the step, so each tap moves exactly one tile.
 */
export async function step(page: Page, d: Dir, pad: Pad = 'keyboard'): Promise<void> {
  const before = await ow(page);
  if (!before) throw new Error('not on the overworld');
  await hold(page, d, pad, true);
  await page.waitForFunction(
    ([x, y, area]) => {
      const o = window.__latentia?.overworld();
      return !o || o.moving || o.x !== x || o.y !== y || o.area !== area || o.mode !== 'walk';
    },
    [before.x, before.y, before.area] as const,
  );
  await hold(page, d, pad, false);
  await page.waitForFunction(() => {
    const o = window.__latentia?.overworld();
    return !o || (!o.moving && o.mode !== 'warp');
  });
}

/** Push into something solid (a wall, an NPC): the player turns to face it and stays on its tile. */
export async function bump(page: Page, d: Dir, pad: Pad = 'keyboard'): Promise<void> {
  const before = await ow(page);
  await hold(page, d, pad, true);
  await page.waitForFunction((dir) => window.__latentia?.overworld()?.facing === dir, d);
  // Well past the turn delay: a free tile would have been stepped onto by now.
  await page.waitForTimeout(250);
  await hold(page, d, pad, false);
  expect(await ow(page)).toMatchObject({ area: before?.area, x: before?.x, y: before?.y, facing: d, moving: false });
}

/** Turn to face `d` without moving (a quick tap, shorter than the turn delay). */
export async function face(page: Page, d: Dir): Promise<void> {
  if ((await ow(page))?.facing === d) return;
  await page.keyboard.down(KEYS[d]);
  await page.waitForFunction((dir) => window.__latentia?.overworld()?.facing === dir, d);
  await page.keyboard.up(KEYS[d]);
  const o = await ow(page);
  expect(o?.moving, 'a tap shorter than the turn delay only turns').toBe(false);
}

/** Walk the shortest route from where the player stands to a tile matching `goal`. */
export async function walkTo(page: Page, goal: (p: Place) => boolean, pad: Pad = 'keyboard'): Promise<void> {
  const o = await ow(page);
  if (!o) throw new Error('not on the overworld');
  const moves = route(LOCALHOST, o, goal);
  if (!moves) throw new Error(`no route from ${o.area}:${o.x},${o.y}`);
  for (const d of moves) await step(page, d, pad);
}

export const at = (area: string, x: number, y: number) => (p: Place) => p.area === area && p.x === x && p.y === y;

/** Close whatever dialogue is open with A presses (each press finishes a typing page, then turns it). */
export async function closeDialogue(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const o = await ow(page);
      if (o?.dialogue) await page.evaluate(() => window.__latentia?.press('a'));
      return o?.dialogue ?? null;
    })
    .toBeNull();
}

export { LOCALHOST };
