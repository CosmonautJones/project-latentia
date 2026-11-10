// The overworld's rules, pure: what blocks a step, what happens when a step completes (a warp, the wild encounter,
// a trainer's sight) and what A does on the faced tile. Which of these are live depends on the journey step: the
// wild patch only on the first walk (so it fires once), the trainer's sight only after the distill.

import type { OverworldStep } from '../flow/flow.js';
import { DELTA } from './direction.js';
import { isWalkableKind, samePlace, tileAt, type NpcDef, type Place, type Pos, type Spot, type TrainerDef, type World } from './map.js';
import { approachPath, inSight } from './sight.js';

/** The scripted wild Tokenibble waits in the patch until the first walk finds it. */
export const encounterLive = (step: OverworldStep): boolean => step === 'walk';
/** Bootcamp Grad battles only once you have a distilled model; before that the Grad just blocks the way. */
export const trainerLive = (step: OverworldStep): boolean => step === 'forest';

/** Every NPC including the trainer. */
export const allNpcs = (w: World): readonly NpcDef[] => [...w.npcs, w.trainer];

export const npcAt = (w: World, p: Place): NpcDef | null => allNpcs(w).find((n) => samePlace(n.at, p)) ?? null;

export const isWalkable = (w: World, p: Place): boolean => isWalkableKind(tileAt(w, p));

/** A tile the player (or a walking NPC) may step onto: walkable ground with nobody standing on it. */
export const canEnter = (w: World, p: Place, ignoreNpc?: string): boolean => {
  if (!isWalkable(w, p)) return false;
  const npc = npcAt(w, p);
  return npc === null || npc.id === ignoreNpc;
};

export const warpAt = (w: World, p: Place): Spot | null => w.warps.find((x) => samePlace(x.from, p))?.to ?? null;

export const isPatch = (w: World, p: Place): boolean => p.area === w.encounter.area && tileAt(w, p) === 'patch';

export const facedPlace = (s: Spot): Place => ({ area: s.area, x: s.x + DELTA[s.facing].dx, y: s.y + DELTA[s.facing].dy });

export type StepOutcome =
  | { readonly kind: 'warp'; readonly to: Spot }
  | { readonly kind: 'encounter' }
  /** The trainer saw the player; it walks `path` to stand next to them. */
  | { readonly kind: 'spotted'; readonly path: readonly Pos[] }
  | { readonly kind: 'none' };

export function trainerSees(w: World, t: TrainerDef, p: Place): boolean {
  if (p.area !== t.at.area) return false;
  return inSight(t.at, t.sight, p, (q) => canEnter(w, { area: p.area, ...q }));
}

/** What a completed step onto `at` sets off (contact is checked on step completion only). */
export function afterStep(w: World, step: OverworldStep, at: Place): StepOutcome {
  const to = warpAt(w, at);
  if (to) return { kind: 'warp', to };
  if (encounterLive(step) && isPatch(w, at)) return { kind: 'encounter' };
  if (trainerLive(step) && trainerSees(w, w.trainer, at)) return { kind: 'spotted', path: approachPath(w.trainer.at, at) };
  return { kind: 'none' };
}

export type Interaction =
  | { readonly kind: 'sign'; readonly text: string }
  | { readonly kind: 'talk'; readonly npc: NpcDef; readonly text: string }
  /** Talking to the trainer once it is live starts its battle, wherever you stand. */
  | { readonly kind: 'engage'; readonly npc: TrainerDef; readonly text: string };

export const npcLine = (npc: NpcDef, step: OverworldStep): string => npc.lines?.[step] ?? npc.line;

/** What A does facing `at.facing` from `at`, or null when there is nothing there. */
export function interact(w: World, step: OverworldStep, at: Spot): Interaction | null {
  const p = facedPlace(at);
  const npc = npcAt(w, p);
  if (npc && npc.id === w.trainer.id && trainerLive(step)) return { kind: 'engage', npc: w.trainer, text: w.trainer.engage };
  if (npc) return { kind: 'talk', npc, text: npcLine(npc, step) };
  const sign = w.signs.find((s) => samePlace(s.at, p));
  return sign ? { kind: 'sign', text: sign.text } : null;
}
