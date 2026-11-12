// What the dev hook (`window.__latentia.battle()`) can see of the running battle: enough for Playwright to drive the
// menus and to check that a result arrives, and to read the fight's report. Plain data only.

import type { Temperature } from '@latentia/engine';
import type { BattleId } from '../content/battles.js';
import type { Disclosure } from './disclosure.js';
import type { FightReport } from '../flow/telemetry.js';
import type { MoveOption, Outcome } from './session.js';
import type { Speed } from './timeline.js';

export type BattlePhase = 'intro' | 'command' | 'hint' | 'playback' | 'why' | 'result';

/** One round's playback: the planned length (animation plus text dwell), its animation part, and the wall clock. */
export interface RoundTiming {
  readonly actualMs: number;
  readonly plannedMs: number;
  readonly animMs: number;
}

export interface BattleResultProbe {
  readonly outcome: Outcome;
  readonly rounds: number;
  /** The fight as reported to the flow (with the debrief's "kept" lines). */
  readonly report: FightReport;
}

export interface BattleProbe {
  readonly id: BattleId;
  readonly phase: BattlePhase;
  readonly round: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
  readonly moves: readonly { readonly moveId: string; readonly cost: number; readonly affordable: boolean; readonly damaging: boolean; readonly power: number | null }[];
  /** The item a first tap selected (two-tap), waiting for the second tap; null when none. */
  readonly armed: { readonly screen: string; readonly index: number } | null;
  /** The telegraphs as on screen ("Kip's Blitzr: NEXT: ATTACK ~6 → SAGELET"; the teammate's with its card). */
  readonly intents: readonly string[];
  /** NUMBERS is on: the details show the numbers. */
  readonly numbers: boolean;
  /** The band's text lines as on screen. */
  readonly band: readonly string[];
  /** What this fight shows (V14). */
  readonly disclosure: Disclosure;
  /** The "why?" popup's text for the latest traces, or null before any deck-driven action. */
  readonly why: string | null;
  /** The round log (the LOG screen), oldest first. */
  readonly log: readonly string[];
  /** Each round's playback timing, in order. */
  readonly roundMs: readonly RoundTiming[];
  readonly result: BattleResultProbe | null;
}

/** The live pieces the probe reads (scenes/battle.ts passes its own). */
export interface ProbeSource {
  readonly id: BattleId;
  readonly phase: BattlePhase;
  readonly round: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
  readonly numbers: boolean;
  readonly armed: BattleProbe['armed'];
  readonly moves: readonly MoveOption[];
  readonly intents: readonly string[];
  readonly band: readonly string[];
  readonly disclosure: Disclosure;
  readonly why: readonly string[];
  readonly log: readonly string[];
  readonly roundMs: readonly RoundTiming[];
  readonly result: BattleResultProbe | null;
}

/** The battle as the dev hook sees it: plain data, copied. */
export function battleProbe(p: ProbeSource): BattleProbe {
  return {
    id: p.id,
    phase: p.phase,
    round: p.round,
    temperature: p.temperature,
    speed: p.speed,
    armed: p.armed,
    moves: p.moves.map((m) => ({ moveId: m.moveId, cost: m.cost, affordable: m.affordable, damaging: m.power !== null, power: m.power })),
    intents: [...p.intents],
    numbers: p.numbers,
    band: [...p.band],
    disclosure: p.disclosure,
    why: p.why.join(' ') || null,
    log: [...p.log],
    roundMs: [...p.roundMs],
    result: p.result,
  };
}
