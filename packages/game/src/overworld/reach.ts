// Breadth-first search over walkable tiles, following warps: used by the map validation (connectivity, "you can't
// skip ahead") and by the e2e to walk the real route.

import { DELTA, DIRS, type Dir } from './direction.js';
import { placeKey, type Place, type World } from './map.js';
import { canEnter, warpAt } from './rules.js';

export interface ReachOptions {
  /** Extra tiles to treat as blocked (e.g. the wild patch, to prove it can't be walked around). */
  readonly blocked?: (p: Place) => boolean;
  /** An NPC to walk through as if absent (e.g. the trainer, to see what it guards). */
  readonly ignoreNpc?: string;
}

interface Node {
  readonly at: Place;
  readonly moves: readonly Dir[];
  /** Where a warp tile sends you: the walk carries on from there. */
  readonly landing: Place | null;
}

function* explore(w: World, from: Place, opts: ReachOptions): Generator<Node> {
  const start: Node = { at: { area: from.area, x: from.x, y: from.y }, moves: [], landing: null };
  const seen = new Set([placeKey(start.at)]);
  const queue: Node[] = [start];
  for (let node = queue.shift(); node; node = queue.shift()) {
    yield node;
    const base = node.landing ?? node.at;
    for (const d of DIRS) {
      const at: Place = { area: base.area, x: base.x + DELTA[d].dx, y: base.y + DELTA[d].dy };
      if (seen.has(placeKey(at)) || !canEnter(w, at, opts.ignoreNpc) || opts.blocked?.(at)) continue;
      seen.add(placeKey(at));
      const to = warpAt(w, at);
      const landing = to ? { area: to.area, x: to.x, y: to.y } : null;
      if (landing) seen.add(placeKey(landing));
      queue.push({ at, moves: [...node.moves, d], landing });
    }
  }
}

/** The shortest list of moves from `from` to a tile matching `goal`, or null when none can be reached. */
export function route(w: World, from: Place, goal: (p: Place) => boolean, opts: ReachOptions = {}): Dir[] | null {
  for (const node of explore(w, from, opts)) if (goal(node.at) || (node.landing && goal(node.landing))) return [...node.moves];
  return null;
}

/** The keys (`area:x,y`) of every tile reachable from `from`. */
export function reachable(w: World, from: Place, opts: ReachOptions = {}): Set<string> {
  const keys = new Set<string>();
  for (const node of explore(w, from, opts)) {
    keys.add(placeKey(node.at));
    if (node.landing) keys.add(placeKey(node.landing));
  }
  return keys;
}
