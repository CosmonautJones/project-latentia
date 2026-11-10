// The overworld on real input: new game → starter → beat the rival (via the hook) → the lab → out the door → the
// trailhead sign → into the patch → the wild battle. Then the return paths: a lost wild battle restarts it, a won
// one comes back to the calm patch, Continue resumes at the step's spawn, and Bootcamp Grad spots you, walks over and
// starts the trainer battle. Also the touch D-pad in portrait and in touch landscape. Any console error fails.

import { expect, test, type Page } from '@playwright/test';
import { at, bump, closeDialogue, face, LOCALHOST, ow, step, walkTo } from './walk.js';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const scene = (page: Page) => page.evaluate(() => window.__latentia?.scene() ?? null);
const flow = (page: Page) => page.evaluate(() => window.__latentia?.flow() ?? null);
const send = (page: Page, e: Parameters<NonNullable<Window['__latentia']>['send']>[0]) => page.evaluate((ev) => window.__latentia?.send(ev), e);

/** Title → new game → pick a starter from the lab menu → beat Kip through the hook → the overworld is up. */
async function toOverworld(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => scene(page)).toBe('Title');
  await send(page, { type: 'newGame' });
  await expect.poll(() => scene(page)).toBe('Overworld');
  await expect
    .poll(async () => {
      if ((await page.evaluate(() => window.__latentia?.menu()?.id)) === 'starter') return true;
      await page.evaluate(() => window.__latentia?.press('a'));
      return false;
    })
    .toBe(true);
  await page.evaluate(() => window.__latentia?.pick('starter', 2));
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('rival');
  expect(await send(page, { type: 'battleWon' })).toBe(true);
  await expect.poll(() => scene(page)).toBe('Overworld');
  await expect.poll(() => ow(page)).not.toBeNull();
}

test('new game → starter → rival won → walk the lab, Localhost and the path → the patch starts the wild battle', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await toOverworld(page);

  // The walk step starts at its spawn in the lab, and the step is saved.
  expect(await ow(page)).toMatchObject({ step: 'walk', area: 'lab', x: 5, y: 4, mode: 'walk', encounterLive: true, trainerLive: false });
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('latentia.save.v0') ?? 'null'));
  expect(saved).toMatchObject({ progress: { step: 'walk', starter: 'forkling' } });

  // Walls stop the player: from the spawn, left along the floor to the wall, which it then only faces.
  await walkTo(page, at('lab', 1, 4));
  await bump(page, 'left');
  // And so do NPCs: the professor stands in the way.
  await walkTo(page, at('lab', 5, 3));
  await bump(page, 'up');

  // The professor: facing them, press A.
  await page.keyboard.press('KeyZ');
  await expect.poll(() => ow(page).then((o) => o?.dialogue ?? '')).toContain('PROF. EPOCH');
  expect((await ow(page))?.mode).toBe('talk');
  // Movement waits for the dialogue; then it closes and the player can move again.
  await closeDialogue(page);
  expect((await ow(page))?.mode).toBe('walk');

  // Out the door: the warp lands outside the lab, in Localhost.
  await walkTo(page, (p) => p.area === 'outside');
  expect(await ow(page)).toMatchObject({ area: 'outside', x: 5, y: 4, facing: 'down' });
  // Back in and out again: each warp's fades remove their listeners, so none pile up.
  const listeners = (await ow(page))?.shutdownListeners;
  expect(listeners).toBeGreaterThan(0);
  await walkTo(page, (p) => p.area === 'lab');
  await walkTo(page, (p) => p.area === 'outside');
  expect((await ow(page))?.shutdownListeners).toBe(listeners);

  // The farmer on the way has a line.
  const farmer = LOCALHOST.npcs.find((n) => n.id === 'farmer')!;
  await walkTo(page, at('outside', farmer.at.x, farmer.at.y + 1));
  await face(page, 'up');
  await page.keyboard.press('Enter');
  await expect.poll(() => ow(page).then((o) => o?.dialogue ?? '')).toContain('cooling towers');
  await closeDialogue(page);

  // The trailhead sign.
  const sign = LOCALHOST.signs[0]!;
  await walkTo(page, at('outside', sign.at.x, sign.at.y + 1));
  await face(page, 'up');
  await page.keyboard.press('KeyZ');
  await expect.poll(() => ow(page).then((o) => o?.dialogue)).toBe('Deprecated Forest. Models here were sunset, not deleted.');
  await closeDialogue(page);

  // Walking the map holds the frame rate (60 fps target; headless Chrome allows some slack).
  expect((await ow(page))?.fps ?? 0).toBeGreaterThanOrEqual(50);

  // Into the unindexed data: the scripted wild Tokenibble.
  await step(page, 'right');
  await expect.poll(() => scene(page)).toBe('Battle');
  expect(await flow(page)).toMatchObject({ step: 'wild', attempt: 0 });
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('wild');

  // Losing the wild battle restarts it (the flow); winning it leads, after the distill, back to the calm patch.
  expect(await send(page, { type: 'battleLost' })).toBe(true);
  await expect.poll(() => flow(page).then((f) => f?.attempt)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.phase ?? null)).toBe('intro');
  expect(await send(page, { type: 'battleWon' })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__latentia?.menu()?.id ?? null)).toBe('distill');
  await page.evaluate(() => window.__latentia?.pick('distill', 0));
  await expect.poll(() => scene(page)).toBe('Overworld');
  expect(await ow(page)).toMatchObject({ step: 'cardTutorial', mode: 'menu', ...LOCALHOST.spawns.cardTutorial });
  // The card tutorial: its first-time hint, then the three example cards over the trailhead.
  await expect.poll(() => ow(page).then((o) => o?.dialogue ?? null)).toMatch(/^CARDS: /);
  await expect
    .poll(async () => {
      if ((await page.evaluate(() => window.__latentia?.menu()?.id)) === 'tutorial-card') return true;
      await page.evaluate(() => window.__latentia?.press('a'));
      return false;
    })
    .toBe(true);
  await page.evaluate(() => window.__latentia?.pick('tutorial-card', 1));
  await expect.poll(() => ow(page).then((o) => o?.step)).toBe('forest');
  expect(await ow(page)).toMatchObject({ mode: 'walk', encounterLive: false, trainerLive: true, ...LOCALHOST.spawns.forest });

  expect(errors).toEqual([]);
});

test('after the distill: the patch is calm, Continue resumes at the spawn, and Bootcamp Grad spots you and battles', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await toOverworld(page);
  for (const e of [{ type: 'reachedTrailhead' }, { type: 'battleWon' }, { type: 'distillChosen', choice: 'graft' }] as const) {
    expect(await send(page, e)).toBe(true);
  }
  await expect.poll(() => ow(page).then((o) => o?.step ?? null)).toBe('forest');

  // Reload and Continue: back at the forest step's spawn.
  await page.reload();
  await expect.poll(() => scene(page)).toBe('Title');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe('Overworld');
  await expect.poll(() => ow(page)).toMatchObject({ step: 'forest', ...LOCALHOST.spawns.forest, mode: 'walk' });

  // Walking through the patch now does nothing.
  await step(page, 'left');
  await step(page, 'right');
  expect(await ow(page)).toMatchObject({ mode: 'walk', step: 'forest' });

  // Into the Grad's sightline (4 tiles in front): "!", the Grad walks up, says its line, and the battle starts.
  const grad = LOCALHOST.trainer;
  await walkTo(page, at('outside', grad.at.x - 4, grad.at.y));
  await expect.poll(() => ow(page).then((o) => o?.mode)).toBe('spotted');
  await expect.poll(() => ow(page).then((o) => o?.trainer)).toEqual({ x: grad.at.x - 3, y: grad.at.y });
  await expect.poll(() => ow(page).then((o) => o?.dialogue ?? '')).toContain('BOOTCAMP GRAD');
  expect((await ow(page))?.facing).toBe('right');
  await closeDialogue(page);
  await expect.poll(() => scene(page)).toBe('Battle');
  expect(await flow(page)).toMatchObject({ step: 'trainer', distill: 'graft' });
  await expect.poll(() => page.evaluate(() => window.__latentia?.battle()?.id ?? null)).toBe('trainer');

  expect(errors).toEqual([]);
});

for (const v of [
  { name: 'portrait 390x844: the band D-pad walks', width: 390, height: 844 },
  { name: 'touch landscape 844x390: the side D-pad walks', width: 844, height: 390 },
]) {
  test(v.name, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await toOverworld(page);
    const expected = v.width < v.height ? 'band' : 'sides';
    expect(await page.evaluate(() => window.__latentia?.layout().controls)).toBe(expected);
    await step(page, 'down', 'touch');
    await step(page, 'right', 'touch');
    expect(await ow(page)).toMatchObject({ area: 'lab', x: 6, y: 5, facing: 'right' });
    // The band's A talks too: face the professor from below and tap it.
    await walkTo(page, at('lab', 5, 3), 'touch');
    await bump(page, 'up', 'touch');
    await page.locator('[data-control="btn-a"]').click();
    await expect.poll(() => ow(page).then((o) => o?.dialogue ?? '')).toContain('PROF. EPOCH');
    await closeDialogue(page);
    expect(errors).toEqual([]);
    await context.close();
  });
}
