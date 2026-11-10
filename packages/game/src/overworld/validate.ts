// The map's design rules, checked in a unit test so a bad edit to the map data fails CI rather than softlocking a
// player: warps land somewhere walkable, spawns are walkable, signs have text, NPCs stand on open ground, the
// trainer has a clear sightline, the lab connects to the trainer, the wild patch can't be walked around, and the
// trainer really does block the way on. Returns every problem found, as readable strings.

import { OVERWORLD_STEPS } from '../flow/flow.js';
import { placeKey, tileAt, type Place, type World } from './map.js';
import { reachable } from './reach.js';
import { allNpcs, canEnter, isPatch, isWalkable, warpAt } from './rules.js';
import { sightLine } from './sight.js';

const at = (p: Place) => placeKey(p);

function checkTiles(w: World, errors: string[]): void {
  for (const a of Object.values(w.areas)) {
    a.tiles.forEach((t, i) => {
      const p = { area: a.id, x: i % a.width, y: Math.floor(i / a.width) };
      if (t === 'sign' && !w.signs.some((s) => at(s.at) === at(p))) errors.push(`sign tile at ${at(p)} has no text`);
    });
  }
  for (const s of w.signs) if (tileAt(w, s.at) !== 'sign') errors.push(`sign at ${at(s.at)} is not on a sign tile`);
}

function checkNpcs(w: World, errors: string[]): void {
  const taken = new Map<string, string>();
  for (const n of allNpcs(w)) {
    const k = at(n.at);
    const other = taken.get(k);
    if (other) errors.push(`npc ${n.id} shares ${k} with ${other}`);
    taken.set(k, n.id);
    if (!isWalkable(w, n.at)) errors.push(`npc ${n.id} stands on ${tileAt(w, n.at)} at ${k}`);
    if (warpAt(w, n.at) || isPatch(w, n.at)) errors.push(`npc ${n.id} stands on a warp or the patch at ${k}`);
    if (n.line.trim() === '') errors.push(`npc ${n.id} has no line`);
  }
}

function checkWarpsAndSpawns(w: World, errors: string[]): void {
  for (const x of w.warps) {
    const name = `warp ${at(x.from)} → ${at(x.to)}`;
    if (!isWalkable(w, x.from)) errors.push(`${name}: start is not walkable`);
    if (!canEnter(w, x.to)) errors.push(`${name}: target is not walkable`);
    else if (warpAt(w, x.to)) errors.push(`${name}: lands on another warp`);
  }
  for (const step of OVERWORLD_STEPS) {
    const s = w.spawns[step];
    if (!canEnter(w, s)) errors.push(`spawn ${step} at ${at(s)} is not walkable`);
    else if (warpAt(w, s)) errors.push(`spawn ${step} at ${at(s)} is on a warp`);
  }
  if (isPatch(w, w.spawns.walk)) errors.push('spawn walk is on the wild patch');
  const lurk = { area: w.encounter.area, ...w.encounter.lurk };
  if (!isPatch(w, lurk)) errors.push(`encounter lurk ${at(lurk)} is not on a patch`);
}

function checkTrainer(w: World, errors: string[]): void {
  const t = w.trainer;
  if (t.sight < 1) errors.push(`trainer ${t.id}: sight must be at least 1`);
  const line = sightLine(t.at, t.sight).map((p) => ({ area: t.at.area, ...p }));
  const blocked = line.find((p) => !canEnter(w, p));
  if (blocked) errors.push(`trainer ${t.id}: sightline blocked at ${at(blocked)}`);
  const front = line[0];
  if (!front) return;

  const fromLab = reachable(w, w.spawns.walk);
  if (!fromLab.has(at(front))) errors.push('the trainer cannot be reached from the walk spawn');
  const skipping = reachable(w, w.spawns.walk, { blocked: (p) => isPatch(w, p) });
  if (skipping.has(at(front))) errors.push('the trainer can be reached without crossing the wild patch');
  // Without the trainer, more than its own tile opens up: it stands in the way of the forest beyond.
  const without = reachable(w, w.spawns.walk, { ignoreNpc: t.id });
  const guarded = [...without].filter((k) => !fromLab.has(k) && k !== at(t.at));
  if (guarded.length === 0) errors.push(`trainer ${t.id} does not block the path`);
}

export function validateWorld(w: World): string[] {
  const errors: string[] = [];
  checkTiles(w, errors);
  checkNpcs(w, errors);
  checkWarpsAndSpawns(w, errors);
  checkTrainer(w, errors);
  return errors;
}
