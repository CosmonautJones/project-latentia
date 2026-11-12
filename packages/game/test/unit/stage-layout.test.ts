import { describe, expect, it } from 'vitest';
import { ART_REACH, battleGeometry, controlSpan, PANEL_HEIGHT, SPRITE_REACH } from '../../src/battle-ui/stage-layout.js';
import { computeViewport, type Layout, type Rect } from '../../src/layout/viewport.js';

// The battle layout (plan v0.1 Q2) at every size the plan reviews, both 240 px short sides (V16) and the largest
// logical sizes, with and without a subagent on the player's side.

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const art = (s: { x: number; y: number }): Rect => ({ x: s.x - 40, y: s.y - SPRITE_REACH.up, width: 80, height: SPRITE_REACH.up });

/** The touch controls' rects in logical px. */
function controls(l: Layout): Rect[] {
  const k = l.game.width / l.logical.width;
  return Object.values(l.buttons)
    .filter((r): r is Rect => r !== undefined)
    .map((r) => ({ x: (r.x - l.game.x) / k, y: (r.y - l.game.y) / k, width: r.width / k, height: r.height / k }));
}

const SIZES = [
  { width: 1366, height: 768, dpr: 1, touch: false },
  { width: 1920, height: 1080, dpr: 1, touch: false },
  { width: 844, height: 390, dpr: 3, touch: true },
  { width: 390, height: 844, dpr: 3, touch: true },
  { width: 360, height: 640, dpr: 3, touch: true },
  { width: 640, height: 360, dpr: 3, touch: true },
  { width: 360, height: 640, dpr: 2, touch: true },
  { width: 640, height: 360, dpr: 2, touch: true },
  { width: 412, height: 915, dpr: 2.625, touch: true },
  { width: 915, height: 412, dpr: 2.625, touch: true },
];

describe('battleGeometry', () => {
  for (const v of SIZES) {
    for (const mate of [false, true]) {
      const l = computeViewport(v);
      // The subagent fights beside you only against the Bootcamp Grad, whose Vibrat is shorter than the starters.
      const foeReach = mate ? (ART_REACH['vibrat'] ?? SPRITE_REACH.up) : SPRITE_REACH.up;
      const g = battleGeometry(l, { mate, moves: 7, foeReach });
      const at = `${v.width}x${v.height}@${v.dpr}${mate ? ' with a subagent' : ''}`;
      const screen: Rect = { x: 0, y: 0, width: l.logical.width, height: l.logical.height };
      const panels = Object.entries(g.slots)
        .filter(([name]) => mate || name !== 'playerSub')
        .filter(([name]) => name !== 'foeSub')
        .map(([name, s]) => ({ name, r: s.panel }));

      it(`${at}: the band is at the bottom, its buttons are at least the tap size and clear of the touch controls`, () => {
        expect(g.band.y + g.band.height).toBe(l.mode === 'portrait' ? l.safe.y + l.safe.height : l.logical.height);
        expect(g.pitch).toBeGreaterThanOrEqual(l.tap);
        expect(g.rows).toBeGreaterThanOrEqual(2);
        expect(inside(g.buttons, g.band)).toBe(true);
        for (const c of controls(l)) expect(overlaps(g.buttons, c), `buttons vs a control at ${c.x},${c.y}`).toBe(false);
        // The text lines stay inside the safe area (they sit beside the side controls in landscape).
        expect(g.text.x).toBeGreaterThanOrEqual(l.safe.x);
        expect(g.text.x + g.text.width).toBeLessThanOrEqual(l.safe.x + l.safe.width);
        expect(g.text.y).toBeGreaterThan(g.band.y);
        expect(g.text.y + g.text.height).toBeLessThanOrEqual(g.buttons.y);
        expect(g.lines).toBe(l.mode === 'portrait' ? (mate ? 5 : 3) : mate ? 4 : 2);
      });

      it(`${at}: the menu never covers a panel; panels are in the safe area, on screen and clear of each other and the telegraph`, () => {
        for (const { name, r } of panels) {
          expect(r.y + r.height, `${name} panel bottom`).toBeLessThanOrEqual(g.band.y);
          expect(r.x, `${name} panel`).toBeGreaterThanOrEqual(name === 'foe' ? 0 : l.safe.x);
          expect(r.x + r.width, `${name} panel`).toBeLessThanOrEqual(l.safe.x + l.safe.width);
          expect(inside(r, screen)).toBe(true);
          for (const o of panels) if (o.name !== name) expect(overlaps(r, o.r), `${name} and ${o.name} panels`).toBe(false);
          expect(overlaps(r, g.foePlan), `${name} panel and the foe telegraph`).toBe(false);
        }
        expect(g.slots.player.panel.height).toBe(PANEL_HEIGHT.player);
        for (const c of controls(l)) for (const { name, r } of panels) expect(overlaps(r, c), `${name} panel vs a control`).toBe(false);
        for (const c of controls(l)) expect(overlaps(g.foePlan, c), 'the telegraph vs a control').toBe(false);
      });

      it(`${at}: every sprite is on screen, above the band, and clear of the HUD it does not belong to`, () => {
        const names = mate ? (['foe', 'player', 'playerSub'] as const) : (['foe', 'player'] as const);
        for (const n of names) {
          const s = g.slots[n].sprite;
          expect(s.x - SPRITE_REACH.side, `${n} x`).toBeGreaterThanOrEqual(0);
          expect(s.x + SPRITE_REACH.side, `${n} x`).toBeLessThanOrEqual(l.logical.width);
          expect(s.y - (n === 'foe' ? foeReach : SPRITE_REACH.up), `${n} top`).toBeGreaterThanOrEqual(l.mode === 'portrait' ? l.safe.y : 0);
          expect(s.y, `${n} feet`).toBeLessThanOrEqual(g.band.y);
        }
        const foe = { ...art(g.slots.foe.sprite), y: g.slots.foe.sprite.y - foeReach, height: foeReach };
        for (const { name, r } of panels) expect(overlaps(foe, r), `the foe sprite vs the ${name} panel`).toBe(false);
        expect(overlaps(foe, g.foePlan), 'the foe sprite vs its telegraph').toBe(false);
        expect(overlaps(art(g.slots.player.sprite), g.slots.player.panel), 'your sprite vs your panel').toBe(false);
      });
    }
  }

  it('portrait has no empty stretch: the band takes the rows the moves need, the player panels sit right on it', () => {
    const tall = computeViewport({ width: 390, height: 844, dpr: 3, touch: true });
    const g = battleGeometry(tall, { mate: false, moves: 7 });
    expect(g.rows).toBe(4);
    expect(g.band.y - (g.slots.player.panel.y + g.slots.player.panel.height)).toBeLessThanOrEqual(4);
  });

  it('controlSpan reads the side controls in landscape and is null on desktop', () => {
    expect(controlSpan(computeViewport({ width: 1366, height: 768, dpr: 1, touch: false }))).toBeNull();
    const span = controlSpan(computeViewport({ width: 640, height: 360, dpr: 2, touch: true }));
    expect(span !== null && span.top > 60 && span.bottom < 170).toBe(true);
  });
});
