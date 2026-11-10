// The core-loop measurement (plan step 8: lose → teach → rematch). A scripted naive player fights Bootcamp Grad with
// each tutorial preset taught to Tokenibble, and on the graft path, through the engine's `simulate`. The naive player
// always uses its orchestrator's strongest affordable damaging move (base power; ties go to the first listed) at the
// default temperature, T2, and Compacts when nothing damaging fits. Seeds are the game's own trainer seeds,
// seedFor('trainer', attempt) for attempt 0, 1, 2, ..., so the measured fights are the ones a player's rematches play.
// Used by scripts/measure-loop.ts (200 seeds, the committed numbers) and test/unit/loop-balance.test.ts (fewer seeds).

import { moveDef, simulate, type BattleState, type RoundCommand, type Temperature } from '@latentia/engine';
import { effectiveCost } from '../src/battle/session.js';
import { rivalBattle, trainerBattle } from '../src/content/battles.js';
import { BOOTCAMP_GRAD, TOKENIBBLE_PRESETS, type CardPreset, type TrainerTuning } from '../src/content/trainers.js';
import { STARTERS, type StarterId } from '../src/flow/flow.js';

const NAIVE_TEMPERATURE: Temperature = 2;

/** The naive player's command for the state before a round (it never mutates `state`). */
export function naiveCommand(state: BattleState): RoundCommand {
  const me = state.creatures[0];
  if (me === undefined || me.fainted || state.sides.a.headless) return {};
  if (me.charging !== null) return { a: { temperature: NAIVE_TEMPERATURE, action: { kind: 'none' } } };
  const free = me.context.window - me.context.tokens.length;
  let best: { moveId: string; power: number } | null = null;
  for (const moveId of me.moves) {
    const d = moveDef(moveId);
    if (d === null || d.power === null || effectiveCost(me, d.cost) > free) continue;
    if (best === null || d.power > best.power) best = { moveId, power: d.power };
  }
  const foe = state.creatures.find((c) => c.side === 'b' && !c.fainted && (c.isOrchestrator || c.slot === 'active'));
  if (best === null || foe === undefined) return { a: { temperature: NAIVE_TEMPERATURE, action: { kind: 'move', moveId: 'compact', target: me.index } } };
  return { a: { temperature: NAIVE_TEMPERATURE, action: { kind: 'move', moveId: best.moveId, target: foe.index } } };
}

/** One row: a preset (or the graft path) and the naive player's wins per starter. */
export interface LoopRow {
  readonly path: CardPreset['verdict'] | 'graft';
  readonly presetId: string | null;
  readonly wins: Readonly<Record<StarterId, number>>;
  /** Fights per starter. */
  readonly seeds: number;
}

/** Wins over every starter, as a fraction of all fights. */
export const pooledWinRate = (row: LoopRow): number => STARTERS.reduce((n, s) => n + row.wins[s], 0) / (row.seeds * STARTERS.length);

function winsFor(seeds: number, grad: TrainerTuning, presetId: string | null): Record<StarterId, number> {
  const wins: Record<StarterId, number> = { sagelet: 0, blitzr: 0, forkling: 0 };
  for (const starter of STARTERS) {
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = trainerBattle(starter, presetId === null ? 'graft' : 'spinUp', presetId, attempt, grad);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: naiveCommand }).winner === 'a') wins[starter]++;
    }
  }
  return wins;
}

/** The three presets (bad, situational, good) then the graft path, `seeds` fights per starter each. */
export function measureLoop(seeds: number, grad: TrainerTuning = BOOTCAMP_GRAD): LoopRow[] {
  const order: CardPreset['verdict'][] = ['bad', 'situational', 'good'];
  const presets = order.map((v) => TOKENIBBLE_PRESETS.find((p) => p.verdict === v)).filter((p): p is CardPreset => p !== undefined);
  return [
    ...presets.map((p): LoopRow => ({ path: p.verdict, presetId: p.id, wins: winsFor(seeds, grad, p.id), seeds })),
    { path: 'graft', presetId: null, wins: winsFor(seeds, grad, null), seeds },
  ];
}

/** The rival fight (Kip, Ruling 146) for the same naive player: wins per starter over `seeds` rival seeds. */
export function measureRival(seeds: number): Record<StarterId, number> {
  const wins: Record<StarterId, number> = { sagelet: 0, blitzr: 0, forkling: 0 };
  for (const starter of STARTERS) {
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = rivalBattle(starter, attempt);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: naiveCommand }).winner === 'a') wins[starter]++;
    }
  }
  return wins;
}
