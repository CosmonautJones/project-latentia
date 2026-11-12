import { describe, expect, it } from 'vitest';
import type { Dir } from '../../src/overworld/direction.js';
import { createWalker, pixelPos, placeWalker, STEP_MS, TURN_MS, updateWalker, isWalking, type WalkerState } from '../../src/overworld/walker.js';
import { cameraFollow, cameraSnap, type CameraBox } from '../../src/overworld/camera.js';

const open = () => true;
const FRAME = 1000 / 60;

/** Run `ms` of frames with `held` down; returns the final state and every tile arrived at. */
function run(s: WalkerState, ms: number, held: Dir | null, canEnter: (x: number, y: number) => boolean = open) {
  const arrivals: Array<{ x: number; y: number }> = [];
  let state = s;
  for (let t = 0; t < ms - 1e-6; t += FRAME) {
    const r = updateWalker(state, FRAME, held, canEnter);
    state = r.state;
    if (r.arrived) arrivals.push({ x: state.x, y: state.y });
  }
  return { state, arrivals };
}

describe('walker: grid movement, a tile per step', () => {
  it('stands still with nothing held', () => {
    const { state, arrivals } = run(createWalker({ x: 3, y: 3, facing: 'down' }), 500, null);
    expect(state).toMatchObject({ x: 3, y: 3, facing: 'down', move: null });
    expect(arrivals).toEqual([]);
  });

  it('holding the faced direction steps at once and arrives one tile on after STEP_MS (about 4 tiles a second)', () => {
    expect(STEP_MS).toBeGreaterThanOrEqual(200);
    expect(STEP_MS).toBeLessThanOrEqual(270);
    const s0 = createWalker({ x: 3, y: 3, facing: 'right' });
    const first = updateWalker(s0, FRAME, 'right', open);
    expect(first.state.move).toMatchObject({ toX: 4, toY: 3 });
    // Logically still on the start tile until the step completes (contact is checked on completion).
    expect(first.state).toMatchObject({ x: 3, y: 3 });
    const { state, arrivals } = run(first.state, STEP_MS, null);
    expect(arrivals).toEqual([{ x: 4, y: 3 }]);
    expect(state.move).toBeNull();
  });

  it('a tap in a new direction only turns; holding past TURN_MS then walks', () => {
    const s0 = createWalker({ x: 3, y: 3, facing: 'down' });
    const tapped = run(s0, TURN_MS / 2, 'left');
    expect(tapped.state).toMatchObject({ x: 3, y: 3, facing: 'left', move: null });
    const released = run(tapped.state, 100, null);
    expect(released.state.move).toBeNull();
    // From a fresh turn, holding long enough starts the step.
    const held = run(s0, TURN_MS + 2 * FRAME, 'left');
    expect(held.state.move).toMatchObject({ toX: 2, toY: 3 });
  });

  it('releasing mid-step still finishes the step: the walker never stops between tiles', () => {
    const s0 = createWalker({ x: 0, y: 0, facing: 'down' });
    const started = run(s0, STEP_MS / 3, 'down');
    expect(started.state.move).not.toBeNull();
    const { state, arrivals } = run(started.state, STEP_MS, null);
    expect(arrivals).toEqual([{ x: 0, y: 1 }]);
    expect(state.move).toBeNull();
  });

  it('holding walks continuously in time: no hitch per tile, so 1 s of holding covers 4 tiles at 250 ms', () => {
    const { arrivals } = run(createWalker({ x: 0, y: 0, facing: 'right' }), STEP_MS * 4 + FRAME / 2, 'right');
    expect(arrivals.map((a) => a.x)).toEqual([1, 2, 3, 4]);
  });

  it('changing direction while walking turns and steps at once (no turn pause mid-walk)', () => {
    let s = createWalker({ x: 0, y: 0, facing: 'right' });
    for (let r = updateWalker(s, FRAME, 'right', open); ; r = updateWalker(s, FRAME, 'right', open)) {
      s = r.state;
      if (r.arrived) break;
    }
    expect(s).toMatchObject({ x: 1, y: 0, move: null });
    const turned = updateWalker(s, FRAME, 'down', open);
    expect(turned.state).toMatchObject({ facing: 'down', move: { toX: 1, toY: 1 } });
  });

  it('a blocked tile: the walker faces it and stays put, reporting the bump once per press', () => {
    const wall = (x: number) => x !== 4;
    const s0 = createWalker({ x: 3, y: 3, facing: 'right' });
    const r = updateWalker(s0, FRAME, 'right', wall);
    expect(r.state).toMatchObject({ x: 3, y: 3, facing: 'right', move: null });
    expect(r.bumped).toBe(true);
    const again = updateWalker(r.state, FRAME, 'right', wall);
    expect(again.bumped).toBe(false);
    expect(again.state.move).toBeNull();
  });

  it('pixel position is an integer tween from tile to tile', () => {
    const s0 = createWalker({ x: 2, y: 1, facing: 'right' });
    expect(pixelPos(s0, 16)).toEqual({ x: 32, y: 16 });
    const mid = run(s0, STEP_MS / 2 - FRAME, 'right').state;
    const p = pixelPos(mid, 16);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    expect(p.x).toBeGreaterThan(32);
    expect(p.x).toBeLessThan(48);
  });

  it('walking (the walk animation plays) through a held walk, including the update between two tiles; standing once released', () => {
    const s0 = createWalker({ x: 2, y: 1, facing: 'right' });
    expect(isWalking(s0)).toBe(false);
    let s = s0;
    for (let t = 0; t < 3 * STEP_MS; t += FRAME) {
      const r = updateWalker(s, FRAME, 'right', () => true);
      s = r.state;
      expect(isWalking(s), `at ${t} ms${r.arrived ? ' (arrival)' : ''}`).toBe(true);
    }
    // Released: the step in progress finishes, then the walker stands.
    s = run(s, STEP_MS + 2 * FRAME, null).state;
    expect(s.move).toBeNull();
    expect(isWalking(s)).toBe(false);
  });

  it('placing (a warp, a scripted turn) drops any step in progress', () => {
    const moving = run(createWalker({ x: 0, y: 0, facing: 'right' }), 50, 'right').state;
    const placed = placeWalker(moving, { x: 9, y: 9, facing: 'up' });
    expect(placed).toMatchObject({ x: 9, y: 9, facing: 'up', move: null });
  });
});

describe('camera: follows the player, clamped to the map', () => {
  const view = { width: 320, height: 180 };
  const deadzone = { width: 32, height: 16 };
  const box = (mapW: number, mapH: number): CameraBox => ({ view, map: { width: mapW, height: mapH }, deadzone });

  it('a map smaller than the view is centred and never scrolls', () => {
    const b = box(192, 128);
    expect(cameraSnap({ x: 10, y: 10 }, b)).toEqual({ x: -64, y: -26 });
    expect(cameraFollow({ x: -64, y: -26 }, { x: 180, y: 120 }, b)).toEqual({ x: -64, y: -26 });
  });

  it('snaps centred on the player, clamped to the map edges', () => {
    const b = box(768, 208);
    expect(cameraSnap({ x: 400, y: 100 }, b)).toEqual({ x: 240, y: 10 });
    expect(cameraSnap({ x: 20, y: 20 }, b)).toEqual({ x: 0, y: 0 });
    expect(cameraSnap({ x: 760, y: 200 }, b)).toEqual({ x: 448, y: 28 });
  });

  it('with a focus (the area the touch controls leave clear), the player is centred in it, even at the map edges', () => {
    // A 270x480 portrait view whose bottom 110 px are under the controls.
    const b: CameraBox = { view: { width: 270, height: 480 }, map: { width: 768, height: 960 }, deadzone, focus: { x: 0, y: 0, width: 270, height: 370 } };
    expect(cameraSnap({ x: 400, y: 500 }, b)).toEqual({ x: 265, y: 315 });
    // At the south edge the focus runs to the map's edge: the player is still above the controls.
    const south = cameraSnap({ x: 400, y: 950 }, b);
    expect(south.y).toBe(960 - 370);
    expect(950 - south.y).toBeLessThan(370);
    expect(cameraFollow(south, { x: 400, y: 958 }, b).y).toBe(960 - 370);
    // Landscape with side controls: the strip between them is the focus; at the west edge the map starts at its left.
    const side: CameraBox = { view: { width: 426, height: 240 }, map: { width: 960, height: 480 }, deadzone, focus: { x: 98, y: 0, width: 281, height: 240 } };
    expect(cameraSnap({ x: 5, y: 200 }, side).x).toBe(-98);
    expect(cameraSnap({ x: 480, y: 200 }, side).x).toBe(480 - 98 - 140);
    // A map narrower than the focus is centred in it.
    const small: CameraBox = { ...side, map: { width: 192, height: 128 } };
    expect(cameraSnap({ x: 5, y: 5 }, small)).toEqual({ x: Math.floor((192 - 281) / 2) - 98, y: -56 });
  });

  it('inside the 2x1-tile deadzone the camera holds; past it, it moves just enough (integer scroll)', () => {
    const b = box(768, 208);
    const start = cameraSnap({ x: 400, y: 100 }, b);
    expect(cameraFollow(start, { x: 410, y: 104 }, b)).toEqual(start);
    const moved = cameraFollow(start, { x: 430.6, y: 100 }, b);
    expect(moved.x).toBe(start.x + 15);
    expect(cameraFollow(start, { x: 340, y: 100 }, b).x).toBe(start.x - 44);
    // And it still clamps.
    expect(cameraFollow({ x: 448, y: 28 }, { x: 767, y: 207 }, b)).toEqual({ x: 448, y: 28 });
  });
});
