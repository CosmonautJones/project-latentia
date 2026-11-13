import { describe, expect, it } from 'vitest';
import { LOCALHOST } from '../../src/content/maps/localhost.js';
import { DELTA, HeldDirections, type Dir } from '../../src/overworld/direction.js';
import { parseWorld, type Place, type World } from '../../src/overworld/map.js';
import { afterStep, canEnter, encounterLive, interact, trainerLive } from '../../src/overworld/rules.js';
import { route } from '../../src/overworld/reach.js';
import { approachPath, inSight, sightLine } from '../../src/overworld/sight.js';

const world: World = parseWorld({
  areas: {
    room: { name: 'Room', rows: ['WWWWW', 'W___W', 'W___W', 'WWDWW'] },
    yard: { name: 'Yard', rows: ['##D#######', '#S.#....##', '#..".....,', '#..#######', '##########'] },
  },
  signs: [{ at: { area: 'yard', x: 1, y: 1 }, text: 'A sign.' }],
  npcs: [{ id: 'host', at: { area: 'room', x: 1, y: 1, facing: 'down' }, line: 'Hi.', lines: { forest: 'Back so soon?' } }],
  trainer: { id: 'grad', at: { area: 'yard', x: 8, y: 2, facing: 'left' }, line: 'Not yet.', engage: 'Battle!', sight: 3 },
  warps: [
    { from: { area: 'room', x: 2, y: 3 }, to: { area: 'yard', x: 2, y: 1, facing: 'down' } },
    { from: { area: 'yard', x: 2, y: 0 }, to: { area: 'room', x: 2, y: 2, facing: 'up' } },
  ],
  encounter: { area: 'yard', lurk: { x: 3, y: 2 } },
  spawns: {
    lab: { area: 'room', x: 2, y: 1, facing: 'down' },
    walk: { area: 'room', x: 2, y: 1, facing: 'down' },
    cardTutorial: { area: 'yard', x: 3, y: 2, facing: 'right' },
    forest: { area: 'yard', x: 3, y: 2, facing: 'right' },
  },
});

const yard = (x: number, y: number): Place => ({ area: 'yard', x, y });
const room = (x: number, y: number): Place => ({ area: 'room', x, y });

describe('collision', () => {
  it('walls, trees, signs, NPCs, the trainer and the map edge block; floor, grass, path, doors and the patch do not', () => {
    expect(canEnter(world, room(0, 0))).toBe(false); // wall
    expect(canEnter(world, yard(0, 0))).toBe(false); // tree
    expect(canEnter(world, yard(1, 1))).toBe(false); // sign
    expect(canEnter(world, room(1, 1))).toBe(false); // the host
    expect(canEnter(world, yard(8, 2))).toBe(false); // the trainer
    expect(canEnter(world, yard(10, 2))).toBe(false); // off the east edge
    expect(canEnter(world, yard(2, -1))).toBe(false); // off the north edge
    expect(canEnter(world, room(2, 2))).toBe(true); // floor
    expect(canEnter(world, yard(2, 2))).toBe(true); // grass
    expect(canEnter(world, yard(9, 2))).toBe(true); // path
    expect(canEnter(world, room(2, 3))).toBe(true); // door
    expect(canEnter(world, yard(3, 2))).toBe(true); // patch
  });
});

describe('after a step', () => {
  it('a door warps, in every step', () => {
    for (const step of ['walk', 'cardTutorial', 'forest'] as const) {
      expect(afterStep(world, step, room(2, 3))).toEqual({ kind: 'warp', to: { area: 'yard', x: 2, y: 1, facing: 'down' } });
    }
  });

  it('the wild patch starts the encounter only on the first walk; after the distill it is calm', () => {
    expect(encounterLive('walk')).toBe(true);
    expect(afterStep(world, 'walk', yard(3, 2))).toEqual({ kind: 'encounter' });
    expect(encounterLive('forest')).toBe(false);
    expect(afterStep(world, 'forest', yard(3, 2))).toEqual({ kind: 'none' });
    expect(afterStep(world, 'cardTutorial', yard(3, 2))).toEqual({ kind: 'none' });
  });

  it('the trainer spots the player in line of sight only on the forest walk, and walks up to them', () => {
    expect(trainerLive('forest')).toBe(true);
    expect(afterStep(world, 'forest', yard(5, 2))).toEqual({ kind: 'spotted', path: [{ x: 7, y: 2 }, { x: 6, y: 2 }] });
    expect(afterStep(world, 'forest', yard(7, 2))).toEqual({ kind: 'spotted', path: [] });
    // Out of range, or beside rather than in front.
    expect(afterStep(world, 'forest', yard(4, 2))).toEqual({ kind: 'none' });
    expect(afterStep(world, 'forest', yard(7, 1))).toEqual({ kind: 'none' });
    // Before the distill the Grad only blocks the way.
    expect(trainerLive('walk')).toBe(false);
    expect(afterStep(world, 'walk', yard(5, 2))).toEqual({ kind: 'none' });
  });

  it('plain ground does nothing', () => {
    expect(afterStep(world, 'walk', yard(2, 2))).toEqual({ kind: 'none' });
  });
});

describe('interaction: A on the faced tile', () => {
  it('reads a sign', () => {
    expect(interact(world, 'walk', { ...yard(1, 2), facing: 'up' })).toEqual({ kind: 'sign', text: 'A sign.' });
  });

  it('talks to an NPC, with a per-step line when there is one', () => {
    expect(interact(world, 'walk', { ...room(2, 1), facing: 'left' })).toMatchObject({ kind: 'talk', text: 'Hi.' });
    expect(interact(world, 'forest', { ...room(2, 1), facing: 'left' })).toMatchObject({ kind: 'talk', text: 'Back so soon?' });
    expect(interact(world, 'walk', { ...room(1, 2), facing: 'up' })).toMatchObject({ kind: 'talk', text: 'Hi.' });
  });

  it('the trainer blocks with a line before the distill, and battles after it (even talked to from outside its sight)', () => {
    expect(interact(world, 'walk', { ...yard(7, 2), facing: 'right' })).toMatchObject({ kind: 'talk', text: 'Not yet.' });
    expect(interact(world, 'forest', { ...yard(7, 2), facing: 'right' })).toMatchObject({ kind: 'engage', text: 'Battle!' });
  });

  it('nothing to face: empty ground, a wall, a tree', () => {
    expect(interact(world, 'walk', { ...room(2, 2), facing: 'down' })).toBeNull();
    expect(interact(world, 'walk', { ...room(2, 1), facing: 'up' })).toBeNull();
    expect(interact(world, 'walk', { ...yard(2, 2), facing: 'right' })).toBeNull();
  });
});

describe('sight', () => {
  const grad = { x: 8, y: 2, facing: 'left' as Dir };
  const clear = () => true;

  it('the sightline is the N tiles in front', () => {
    expect(sightLine(grad, 3)).toEqual([{ x: 7, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 2 }]);
    expect(sightLine({ x: 2, y: 2, facing: 'down' }, 2)).toEqual([{ x: 2, y: 3 }, { x: 2, y: 4 }]);
  });

  it('sees a target in front within range only', () => {
    expect(inSight(grad, 3, { x: 5, y: 2 }, clear)).toBe(true);
    expect(inSight(grad, 3, { x: 7, y: 2 }, clear)).toBe(true);
    expect(inSight(grad, 3, { x: 4, y: 2 }, clear)).toBe(false); // too far
    expect(inSight(grad, 3, { x: 9, y: 2 }, clear)).toBe(false); // behind
    expect(inSight(grad, 3, { x: 6, y: 1 }, clear)).toBe(false); // off the line
    expect(inSight(grad, 3, { x: 8, y: 2 }, clear)).toBe(false); // the same tile
  });

  it('an obstacle between them blocks the view', () => {
    const wallAt6 = (p: { x: number; y: number }) => !(p.x === 6 && p.y === 2);
    expect(inSight(grad, 3, { x: 5, y: 2 }, wallAt6)).toBe(false);
    expect(inSight(grad, 3, { x: 7, y: 2 }, wallAt6)).toBe(true);
  });

  it('the approach walks up to the tile next to the target', () => {
    expect(approachPath(grad, { x: 5, y: 2 })).toEqual([{ x: 7, y: 2 }, { x: 6, y: 2 }]);
    expect(approachPath(grad, { x: 7, y: 2 })).toEqual([]);
  });
});

describe('routes (BFS through warps)', () => {
  it('finds the shortest walk from the room through the door to the patch', () => {
    const r = route(world, world.spawns.walk, (p) => p.area === 'yard' && p.x === 3 && p.y === 2);
    // down to the door (warp to yard 2,1), down, right onto the patch.
    expect(r).toEqual(['down', 'down', 'down', 'right']);
  });

  it('returns null when the goal cannot be reached', () => {
    expect(route(world, world.spawns.walk, (p) => p.area === 'yard' && p.x === 9 && p.y === 2)).toBeNull();
  });

  it('following the Localhost route step by step never enters a blocked tile', () => {
    const w = LOCALHOST;
    const r = route(w, w.spawns.walk, (p) => p.area === 'outside' && w.areas['outside']!.tiles[p.y * w.areas['outside']!.width + p.x] === 'patch');
    expect(r).not.toBeNull();
    let at: Place = w.spawns.walk;
    for (const d of r!) {
      const next = { area: at.area, x: at.x + DELTA[d].dx, y: at.y + DELTA[d].dy };
      expect(canEnter(w, next), `${d} from ${JSON.stringify(at)}`).toBe(true);
      const o = afterStep(w, 'forest', next);
      at = o.kind === 'warp' ? o.to : next;
    }
  });
});

describe('held directions', () => {
  it('the most recent held direction wins; releasing it falls back to the one still held', () => {
    const h = new HeldDirections();
    expect(h.current).toBeNull();
    h.press('right');
    h.press('up');
    expect(h.current).toBe('up');
    h.release('up');
    expect(h.current).toBe('right');
    h.press('right'); // a repeat does not duplicate
    h.release('right');
    expect(h.current).toBeNull();
    h.press('left');
    h.clear();
    expect(h.current).toBeNull();
  });
});
