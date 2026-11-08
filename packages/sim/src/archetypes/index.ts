import type { Archetype } from '../types.js';
import { CODE_LOCK } from './code-lock.js';
import { MEMORY_STALL } from './memory-stall.js';
import { MIXED } from './mixed.js';
import { OPEN_SWARM } from './open-swarm.js';
import { REASONING_NUKE } from './reasoning-nuke.js';
import { SEARCH_ANTI_HALLU } from './search-anti-hallu.js';
import { SPEED_RUSH } from './speed-rush.js';
import { VOICE_PRESSURE } from './voice-injection.js';

// The twenty archetypes the round-robin, the balance targets and the deck search run on (spec §9, Task C2): slice
// species with every creature at L8 (Ruling 128: the early-gym band, so v2 and an 8-card Autopilot deck, Ruling 121),
// each a gridded side of 1 orchestrator, 2 active subagents and 1 bench creature (Ruling 130), every subagent on a
// deck. Creature ids are `<archetype id>/<local id>`; mirrorOf renames a copy for a mirror match (Ruling 129).

export const ARCHETYPES: readonly Archetype[] = [
  ...SPEED_RUSH,
  ...REASONING_NUKE,
  ...OPEN_SWARM,
  ...CODE_LOCK,
  ...VOICE_PRESSURE,
  ...MEMORY_STALL,
  ...SEARCH_ANTI_HALLU,
  ...MIXED,
];

export { mirrorOf } from './build.js';
export { starterGrid, type StarterId } from './starter-grids.js';
