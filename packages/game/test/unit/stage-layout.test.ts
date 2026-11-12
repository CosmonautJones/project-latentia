import { describe, expect, it } from 'vitest';
import { PANEL_HEIGHT, PANEL_WIDTH, SPRITE_REACH, stageGeometry } from '../../src/battle-ui/stage-layout.js';
import { computeViewport, type Rect } from '../../src/layout/viewport.js';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('stageGeometry', () => {
  // The review sizes plus both 240 px short sides (360x640 at DPR 2, and turned).
  const sizes = [
    { width: 1366, height: 768, dpr: 1, touch: false },
    { width: 1920, height: 1080, dpr: 1, touch: false },
    { width: 844, height: 390, dpr: 3, touch: true },
    { width: 390, height: 844, dpr: 3, touch: true },
    { width: 360, height: 640, dpr: 3, touch: true },
    { width: 360, height: 640, dpr: 2, touch: true },
    { width: 640, height: 360, dpr: 2, touch: true },
    { width: 640, height: 360, dpr: 3, touch: true },
  ];

  it('every panel is inside the safe area and clear of the others; every 96 px sprite is on screen; the box fits under the field', () => {
    for (const v of sizes) {
      const l = computeViewport(v);
      const g = stageGeometry(l);
      const at = `${v.width}x${v.height}@${v.dpr}`;
      const panels = Object.entries(g.slots).map(([name, s]) => ({ name, r: { ...s.panel, width: PANEL_WIDTH[s.variant], height: PANEL_HEIGHT[s.variant] } }));
      for (const { name, r } of panels) {
        expect(r.x, `${at} ${name} panel`).toBeGreaterThanOrEqual(l.safe.x);
        expect(r.x + r.width, `${at} ${name} panel`).toBeLessThanOrEqual(l.safe.x + l.safe.width);
        expect(r.y, `${at} ${name} panel`).toBeGreaterThanOrEqual(0);
        for (const o of panels) if (o.name !== name) expect(overlaps(r, o.r), `${at} ${name} and ${o.name} panels`).toBe(false);
      }
      for (const [name, s] of Object.entries(g.slots)) {
        // A creature's art reaches SPRITE_REACH.side px either side of its feet and SPRITE_REACH.up px above them.
        expect(s.sprite.x - SPRITE_REACH.side >= 0 && s.sprite.x + SPRITE_REACH.side <= l.logical.width, `${at} ${name} sprite x`).toBe(true);
        expect(s.sprite.y - SPRITE_REACH.up, `${at} ${name} sprite top`).toBeGreaterThanOrEqual(0);
        expect(s.sprite.y, `${at} ${name} sprite feet`).toBeLessThanOrEqual(g.height);
      }
      // The foe's whole sprite is clear of its own panel.
      const foe = g.slots.foe;
      expect(overlaps({ x: foe.sprite.x - SPRITE_REACH.side, y: foe.sprite.y - SPRITE_REACH.up, width: 2 * SPRITE_REACH.side, height: SPRITE_REACH.up }, panels[0]!.r), `${at} foe sprite vs panel`).toBe(false);
      // The foe's feet and platform are clear of the player's panel under them.
      expect(foe.sprite.y + 6, `${at} foe feet vs player panel`).toBeLessThanOrEqual(g.slots.player.panel.y);
      // The bottom box (42 px) fits under the field.
      expect(g.height + 42, at).toBeLessThanOrEqual(l.safe.y + l.safe.height);
    }
  });

  it('landscape centres the field in the safe area', () => {
    const l = computeViewport({ width: 1366, height: 768, dpr: 1, touch: false });
    const g = stageGeometry(l);
    const left = g.slots.foe.panel.x - 6;
    const right = g.slots.player.panel.x + PANEL_WIDTH.player + 6;
    expect(Math.abs(left - (l.logical.width - right))).toBeLessThanOrEqual(1);
  });
});
