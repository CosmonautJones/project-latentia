import { describe, expect, it } from 'vitest';
import { LOCALHOST } from '../../src/content/maps/localhost.js';
import { OVERWORLD_STEPS } from '../../src/flow/flow.js';
import { LEGEND, parseArea, parseWorld, regionName, tileAt, type WorldSource } from '../../src/overworld/map.js';
import { canEnter, isPatch, npcAt, warpAt } from '../../src/overworld/rules.js';
import { reachable, route } from '../../src/overworld/reach.js';
import { sightLine } from '../../src/overworld/sight.js';
import { validateWorld } from '../../src/overworld/validate.js';

/** A tiny world that passes validation: a room with a door, and a yard with a patch the trainer stands behind. */
const fixture = (): WorldSource => ({
  areas: {
    room: { name: 'Room', rows: ['WWWWW', 'W___W', 'W___W', 'WWDWW'] },
    yard: {
      name: 'Yard',
      rows: [
        '##D#######',
        '#S.#....##',
        '#..".....,', // the patch at (3,2) is the only way east; the trainer at (8,2) guards (9,2)
        '#..#######',
        '##########',
      ],
    },
  },
  signs: [{ at: { area: 'yard', x: 1, y: 1 }, text: 'A sign.' }],
  npcs: [{ id: 'host', look: 'professor', at: { area: 'room', x: 1, y: 1, facing: 'down' }, line: 'Hi.' }],
  trainer: { id: 'grad', look: 'grad', at: { area: 'yard', x: 8, y: 2, facing: 'left' }, line: 'Not yet.', engage: 'Battle!', sight: 3 },
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

const errorsFor = (edit: (s: WorldSource) => WorldSource): string[] => validateWorld(parseWorld(edit(fixture())));

describe('map parsing', () => {
  it('reads a character grid through the legend, row-major', () => {
    const a = parseArea('t', { name: 'T', rows: ['#.,', 'WD"'] });
    expect(a).toMatchObject({ id: 't', width: 3, height: 2 });
    expect(a.tiles).toEqual(['tree', 'grass', 'path', 'wall', 'door', 'patch']);
  });

  it('every legend character maps to a distinct tile kind', () => {
    const kinds = Object.values(LEGEND);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('rejects ragged rows, unknown characters and empty areas, naming the place', () => {
    expect(() => parseArea('t', { name: 'T', rows: ['###', '##'] })).toThrow(/t: row 1 is 2 wide, expected 3/);
    expect(() => parseArea('t', { name: 'T', rows: ['#?#'] })).toThrow(/t: unknown tile '\?' at \(1,0\)/);
    expect(() => parseArea('t', { name: 'T', rows: [] })).toThrow(/t: no rows/);
  });

  it('reads outside the bounds as void (never walkable)', () => {
    const w = parseWorld(fixture());
    expect(tileAt(w, { area: 'room', x: -1, y: 0 })).toBe('void');
    expect(tileAt(w, { area: 'room', x: 0, y: 9 })).toBe('void');
    expect(tileAt(w, { area: 'nowhere', x: 0, y: 0 })).toBe('void');
  });

  it('the fixture itself is valid', () => {
    expect(validateWorld(parseWorld(fixture()))).toEqual([]);
  });
});

describe('map validation catches each broken rule', () => {
  it('a warp to a missing area, off the map, or into a wall', () => {
    expect(errorsFor((s) => ({ ...s, warps: [{ from: s.warps[0]!.from, to: { area: 'attic', x: 1, y: 1, facing: 'up' } }, s.warps[1]!] }))).toContainEqual(
      expect.stringMatching(/warp room:2,3 → attic:1,1: target is not walkable/),
    );
    expect(errorsFor((s) => ({ ...s, warps: [{ from: s.warps[0]!.from, to: { area: 'yard', x: 0, y: 0, facing: 'up' } }, s.warps[1]!] }))).toContainEqual(
      expect.stringMatching(/warp room:2,3 → yard:0,0: target is not walkable/),
    );
  });

  it('a warp that lands on another warp (a loop) or starts on an unwalkable tile', () => {
    expect(errorsFor((s) => ({ ...s, warps: [{ from: s.warps[0]!.from, to: { area: 'yard', x: 2, y: 0, facing: 'up' } }, s.warps[1]!] }))).toContainEqual(
      expect.stringMatching(/warp room:2,3 → yard:2,0: lands on another warp/),
    );
    expect(errorsFor((s) => ({ ...s, warps: [...s.warps, { from: { area: 'room', x: 0, y: 0 }, to: { area: 'room', x: 2, y: 2, facing: 'up' } }] }))).toEqual([
      expect.stringMatching(/warp room:0,0 → room:2,2: start is not walkable/),
    ]);
  });

  it('a spawn on a wall, on an NPC, or on a warp', () => {
    const spawnAt = (x: number, y: number) => (s: WorldSource) => ({ ...s, spawns: { ...s.spawns, walk: { area: 'room', x, y, facing: 'down' as const } } });
    expect(errorsFor(spawnAt(0, 0))).toContainEqual(expect.stringMatching(/spawn walk at room:0,0 is not walkable/));
    expect(errorsFor(spawnAt(1, 1))).toContainEqual(expect.stringMatching(/spawn walk at room:1,1 is not walkable/));
    expect(errorsFor(spawnAt(2, 3))).toContainEqual(expect.stringMatching(/spawn walk at room:2,3 is on a warp/));
  });

  it('a sign tile without text, and sign text off a sign tile', () => {
    expect(errorsFor((s) => ({ ...s, signs: [] }))).toEqual([expect.stringMatching(/sign tile at yard:1,1 has no text/)]);
    expect(errorsFor((s) => ({ ...s, signs: [...s.signs, { at: { area: 'yard', x: 2, y: 2 }, text: 'Lost.' }] }))).toEqual([
      expect.stringMatching(/sign at yard:2,2 is not on a sign tile/),
    ]);
  });

  it('two NPCs on one tile, or an NPC in a tree', () => {
    expect(errorsFor((s) => ({ ...s, npcs: [...s.npcs, { ...s.npcs[0]!, id: 'twin' }] }))).toContainEqual(
      expect.stringMatching(/npc twin shares room:1,1/),
    );
    expect(errorsFor((s) => ({ ...s, npcs: [{ ...s.npcs[0]!, at: { area: 'room', x: 0, y: 0, facing: 'down' } }] }))).toContainEqual(
      expect.stringMatching(/npc host stands on wall/),
    );
  });

  it('a trainer whose sightline is blocked', () => {
    expect(errorsFor((s) => ({ ...s, trainer: { ...s.trainer, sight: 8 } }))).toContainEqual(expect.stringMatching(/trainer grad: sightline blocked at yard:0,2/));
    expect(errorsFor((s) => ({ ...s, trainer: { ...s.trainer, at: { ...s.trainer.at, facing: 'up' } } }))).toContainEqual(
      expect.stringMatching(/trainer grad: sightline blocked at yard:8,1/),
    );
  });

  it('a map where the trainer cannot be reached from the lab', () => {
    const walled = (s: WorldSource) => ({ ...s, areas: { ...s.areas, yard: { ...s.areas['yard']!, rows: s.areas['yard']!.rows.map((r, y) => (y === 2 ? '#.."#....,' : r)) } } });
    expect(errorsFor(walled)).toContainEqual(expect.stringMatching(/the trainer cannot be reached from the walk spawn/));
  });

  it('a map where the wild patch can be walked around (the encounter could be skipped)', () => {
    const bypass = (s: WorldSource) => ({ ...s, areas: { ...s.areas, yard: { ...s.areas['yard']!, rows: s.areas['yard']!.rows.map((r, y) => (y === 3 ? '#....#####' : r)) } } });
    expect(errorsFor(bypass)).toContainEqual(expect.stringMatching(/the trainer can be reached without crossing the wild patch/));
  });

  it('a trainer who does not block the way on', () => {
    // Moved up out of the corridor, the Grad still sees down a clear line but no longer stands in the way.
    const around = (s: WorldSource) => ({ ...s, trainer: { ...s.trainer, at: { area: 'yard', x: 7, y: 1, facing: 'left' as const } } });
    expect(errorsFor(around)).toContainEqual(expect.stringMatching(/trainer grad does not block the path/));
  });

  it('an encounter with no patch under its lurker', () => {
    expect(errorsFor((s) => ({ ...s, encounter: { area: 'yard', lurk: { x: 2, y: 2 } } }))).toContainEqual(expect.stringMatching(/encounter lurk yard:2,2 is not on a patch/));
  });
});

describe('the Localhost → Deprecated Forest trailhead map', () => {
  const w = LOCALHOST;

  it('passes every validation rule', () => {
    expect(validateWorld(w)).toEqual([]);
  });

  it('has the lab interior, then the exterior about 2–3 screens wide (20 tiles a screen), in 16x16 tiles', () => {
    expect(Object.keys(w.areas)).toEqual(['lab', 'outside']);
    expect(w.areas['lab']!.width).toBeLessThanOrEqual(20);
    expect(w.areas['lab']!.height).toBeLessThanOrEqual(11);
    expect(w.areas['outside']!.width).toBeGreaterThanOrEqual(40);
    expect(w.areas['outside']!.width).toBeLessThanOrEqual(60);
  });

  it('has a spawn for every overworld step, and the walk starts in the lab next to the professor', () => {
    expect(Object.keys(w.spawns).sort()).toEqual([...OVERWORLD_STEPS].sort());
    expect(w.spawns.walk.area).toBe('lab');
    expect(w.npcs.find((n) => n.id === 'professor')?.at.area).toBe('lab');
    // The lab step starts facing the professor, one tile in front of them, for the intro and the starter pick.
    const prof = w.npcs.find((n) => n.id === 'professor')?.at;
    expect(w.spawns.lab).toEqual({ area: 'lab', x: prof?.x, y: (prof?.y ?? 0) + 1, facing: 'up' });
    // The forest walk resumes in the calm patch, where Tokenibble was.
    expect(isPatch(w, w.spawns.forest)).toBe(true);
    expect(isPatch(w, w.spawns.cardTutorial)).toBe(true);
  });

  it('the lab door and the exit warp to each other', () => {
    const out = w.warps.find((x) => x.from.area === 'lab');
    const back = w.warps.find((x) => x.from.area === 'outside');
    expect(out && back).toBeTruthy();
    expect(tileAt(w, out!.from)).toBe('door');
    expect(tileAt(w, back!.from)).toBe('door');
    expect(out!.to.area).toBe('outside');
    expect(back!.to.area).toBe('lab');
    expect(warpAt(w, out!.to)).toBeNull();
  });

  it('lays out lab → Localhost → path → trailhead west to east: sign, then patch, then Bootcamp Grad', () => {
    const sign = w.signs[0]!;
    expect(w.signs).toHaveLength(1);
    expect(sign.text).toBe('Deprecated Forest. Models here were sunset, not deleted.');
    const patchXs = w.areas['outside']!.tiles.flatMap((t, i) => (t === 'patch' ? [i % w.areas['outside']!.width] : []));
    expect(sign.at.x).toBeLessThan(Math.min(...patchXs));
    expect(Math.max(...patchXs)).toBeLessThan(w.trainer.at.x);
    // "A little past it": the Grad's sightline starts within a few tiles of the patch.
    expect(w.trainer.at.x - Math.max(...patchXs)).toBeLessThanOrEqual(10);
    expect(w.trainer).toMatchObject({ id: 'bootcamp-grad', sight: 4 });
  });

  it('the route from the lab to the patch exists, goes out the lab door and is short', () => {
    const r = route(w, w.spawns.walk, (p) => isPatch(w, p));
    expect(r).not.toBeNull();
    expect(r!.length).toBeLessThan(60);
  });

  it('the trainer sees down a clear line, reachable from the lab', () => {
    for (const p of sightLine(w.trainer.at, w.trainer.sight)) expect(canEnter(w, { area: w.trainer.at.area, ...p })).toBe(true);
    const seen = reachable(w, w.spawns.walk);
    expect(seen.has(`outside:${w.trainer.at.x - 1},${w.trainer.at.y}`)).toBe(true);
  });

  it('names the place you stand in: the lab, Localhost, then the Deprecated Forest from the trailhead on', () => {
    expect(regionName(w, w.spawns.walk)).toBe("Prof. Epoch's lab");
    expect(regionName(w, { area: 'outside', x: 5, y: 4 })).toBe('Localhost');
    expect(regionName(w, { area: 'outside', x: w.signs[0]!.at.x, y: 3 })).toBe('Deprecated Forest');
    expect(regionName(w, w.trainer.at)).toBe('Deprecated Forest');
  });

  it('NPCs are where the brief puts them: the professor in the lab, one townsperson outside', () => {
    expect(w.npcs.map((n) => n.id)).toEqual(['professor', 'farmer']);
    expect(npcAt(w, w.trainer.at)?.id).toBe('bootcamp-grad');
  });
});
