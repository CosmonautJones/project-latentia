// The core-loop measurement (plan step 8: lose → teach → rematch). A scripted naive player fights Bootcamp Grad with
// each tutorial preset taught to Tokenibble, and on the graft path, through the engine's `simulate`. The naive player
// always uses its orchestrator's strongest affordable damaging move (base power; ties go to the first listed) at the
// default temperature, T2, and Compacts when nothing damaging fits. Seeds are the game's own trainer seeds,
// seedFor('trainer', attempt) for attempt 0, 1, 2, ..., so the measured fights are the ones a player's rematches play.
// Used by scripts/measure-loop.ts (200 seeds, the committed numbers) and test/unit/loop-balance.test.ts (fewer seeds).

import { getIntents, moveDef, previewDamage, simulate, type BattleState, type RoundCommand, type Temperature } from '@latentia/engine';
import { classifyMove } from '../src/battle/telegraph.js';
import { effectiveCost } from '../src/battle/session.js';
import { rivalBattle, trainerBattle, wildBattle } from '../src/content/battles.js';
import { GRAFT_MOVE } from '../src/content/grids.js';
import { BOOTCAMP_GRAD, TOKENIBBLE_PRESETS, type CardPreset, type TrainerTuning } from '../src/content/trainers.js';
import { STARTERS, type StarterId } from '../src/flow/flow.js';

const NAIVE_TEMPERATURE: Temperature = 2;

/** How a scripted player plays: its dial, and (optionally) a move it prefers once free context is this low. */
interface Play {
  readonly temperature: Temperature;
  readonly prefer?: { readonly moveId: string; readonly atFreeOrBelow: number };
}

function scriptedCommand(state: BattleState, play: Play): RoundCommand {
  const me = state.creatures[0];
  if (me === undefined || me.fainted || state.sides.a.headless) return {};
  const { temperature } = play;
  if (me.charging !== null) return { a: { temperature, action: { kind: 'none' } } };
  const free = me.context.window - me.context.tokens.length;
  const affordable = (moveId: string) => {
    const d = moveDef(moveId);
    return d !== null && effectiveCost(me, d.cost) <= free;
  };
  let best: { moveId: string; power: number } | null = null;
  for (const moveId of me.moves) {
    const d = moveDef(moveId);
    if (d === null || d.power === null || !affordable(moveId)) continue;
    if (best === null || d.power > best.power) best = { moveId, power: d.power };
  }
  const p = play.prefer;
  if (p !== undefined && free <= p.atFreeOrBelow && me.moves.includes(p.moveId) && affordable(p.moveId)) best = { moveId: p.moveId, power: 0 };
  const foe = state.creatures.find((c) => c.side === 'b' && !c.fainted && (c.isOrchestrator || c.slot === 'active'));
  if (best === null || foe === undefined) return { a: { temperature, action: { kind: 'move', moveId: 'compact', target: me.index } } };
  return { a: { temperature, action: { kind: 'move', moveId: best.moveId, target: foe.index } } };
}

/** The naive player's command for the state before a round (it never mutates `state`). */
export function naiveCommand(state: BattleState): RoundCommand {
  return scriptedCommand(state, { temperature: NAIVE_TEMPERATURE });
}

/** The share of its HP a telegraphed attack must threaten before the telegraph-reading player guards (plan Q2). */
export const GUARD_AT_HP_FRACTION = 0.25;

/** How the telegraph-reading player measures "25% of its HP": of its HP now, or of its full bar; and whether it ever guards twice running. */
export interface ReadOptions {
  readonly of: 'hp' | 'maxHp';
  readonly twiceRunning: boolean;
}

/**
 * The player who reads the telegraph (plan v0.1 Q2): the naive player, except that when a foe telegraphs an Attack on
 * its orchestrator whose "~N" (the midpoint of previewDamage, as the HUD shows it) is at least 25% of its HP, it
 * raises Guardrail instead, if it can afford it. By default "its HP" is its full bar and it does not guard twice in a
 * row (a second guard in a row succeeds only a third of the time); `readsTelegraph` makes the other readings.
 */
export const telegraphCommand = (state: BattleState): RoundCommand => readsTelegraph(state, { of: 'maxHp', twiceRunning: false });

export function readsTelegraph(state: BattleState, o: ReadOptions): RoundCommand {
  const naive = naiveCommand(state);
  const me = state.creatures[0];
  const guard = moveDef('guardrail');
  if (naive.a === undefined || naive.a.action.kind !== 'move' || me === undefined || guard === null || !me.moves.includes('guardrail')) return naive;
  const free = me.context.window - me.context.tokens.length;
  if (effectiveCost(me, guard.cost) > free || (!o.twiceRunning && me.guardStreak > 0)) return naive;
  const hp = o.of === 'hp' ? me.hp : me.maxHp;
  const threatened = getIntents(state).some((i) => {
    const actor = state.creatures[i.actor];
    const d = moveDef(i.moveId);
    if (actor?.side !== 'b' || i.target !== me.index || d === null) return false;
    const p = previewDamage(state, i);
    return p !== null && classifyMove(d, true) === 'attack' && Math.round((p.min + p.max) / 2) >= GUARD_AT_HP_FRACTION * hp;
  });
  return threatened ? { a: { temperature: naive.a.temperature, action: { kind: 'move', moveId: 'guardrail', target: me.index } } } : naive;
}

/** A player's command for the state before a round. */
export type Player = (state: BattleState) => RoundCommand;

/**
 * The naive player who follows the graft path's loss hint (content/journey-text.ts GRAFT_HINTS) for `starter`:
 * Sagelet and Forkling use the grafted Token Nibble once 4 or fewer cells are free; Blitzr, whose hits all cost 1
 * anyway, turns the dial down to T0.
 */
export const GRAFT_HINT_PLAY: Readonly<Record<StarterId, Play>> = {
  sagelet: { temperature: NAIVE_TEMPERATURE, prefer: { moveId: GRAFT_MOVE, atFreeOrBelow: 4 } },
  blitzr: { temperature: 0 },
  forkling: { temperature: NAIVE_TEMPERATURE, prefer: { moveId: GRAFT_MOVE, atFreeOrBelow: 4 } },
};

/** Graft-path wins per starter over `seeds` trainer seeds: the naive player, then the one who follows the hint. */
export function measureGraftHint(seeds: number): Record<StarterId, { naive: number; hinted: number }> {
  const out = {} as Record<StarterId, { naive: number; hinted: number }>;
  for (const starter of STARTERS) {
    let naive = 0;
    let hinted = 0;
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = trainerBattle(starter, 'graft', null, attempt);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: naiveCommand }).winner === 'a') naive++;
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: (s) => scriptedCommand(s, GRAFT_HINT_PLAY[starter]) }).winner === 'a') hinted++;
    }
    out[starter] = { naive, hinted };
  }
  return out;
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

function winsFor(seeds: number, grad: TrainerTuning, presetId: string | null, player: Player): Record<StarterId, number> {
  const wins: Record<StarterId, number> = { sagelet: 0, blitzr: 0, forkling: 0 };
  for (const starter of STARTERS) {
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = trainerBattle(starter, presetId === null ? 'graft' : 'spinUp', presetId, attempt, grad);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: player }).winner === 'a') wins[starter]++;
    }
  }
  return wins;
}

/** The three presets (bad, situational, good) then the graft path, `seeds` fights per starter each. */
export function measureLoop(seeds: number, grad: TrainerTuning = BOOTCAMP_GRAD, player: Player = naiveCommand): LoopRow[] {
  const order: CardPreset['verdict'][] = ['bad', 'situational', 'good'];
  const presets = order.map((v) => TOKENIBBLE_PRESETS.find((p) => p.verdict === v)).filter((p): p is CardPreset => p !== undefined);
  return [
    ...presets.map((p): LoopRow => ({ path: p.verdict, presetId: p.id, wins: winsFor(seeds, grad, p.id, player), seeds })),
    { path: 'graft', presetId: null, wins: winsFor(seeds, grad, null, player), seeds },
  ];
}

/** The rival fight (Kip, Ruling 146) for the same naive player (or `player`): wins per starter over `seeds` rival seeds. */
export function measureRival(seeds: number, player: Player = naiveCommand): Record<StarterId, number> {
  const wins: Record<StarterId, number> = { sagelet: 0, blitzr: 0, forkling: 0 };
  for (const starter of STARTERS) {
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = rivalBattle(starter, attempt);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: player }).winner === 'a') wins[starter]++;
    }
  }
  return wins;
}

/** The wild Tokenibble for `player`: wins per starter over `seeds` wild seeds. */
export function measureWild(seeds: number, player: Player = naiveCommand): Record<StarterId, number> {
  const wins: Record<StarterId, number> = { sagelet: 0, blitzr: 0, forkling: 0 };
  for (const starter of STARTERS) {
    for (let attempt = 0; attempt < seeds; attempt++) {
      const def = wildBattle(starter, attempt);
      if (simulate(def.setup, def.seed, { kind: 'scripted', next: player }).winner === 'a') wins[starter]++;
    }
  }
  return wins;
}
