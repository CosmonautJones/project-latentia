// What the dev hook (`window.__latentia.battle()`) can see of the running battle: enough for Playwright to drive the
// menus and to check that a result arrives, and to read the fight's report. Plain data only.

import type { Temperature } from '@latentia/engine';
import type { BattleId } from '../content/battles.js';
import type { FightReport } from '../flow/telemetry.js';
import type { Outcome } from './session.js';
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
  /** The intent preview lines as on screen ("Kip's Blitzr: ?" while hidden). */
  readonly intents: readonly string[];
  /** The "why?" popup's text for the latest traces, or null before any deck-driven action. */
  readonly why: string | null;
  /** The round log (the LOG screen), oldest first. */
  readonly log: readonly string[];
  /** Each round's playback timing, in order. */
  readonly roundMs: readonly RoundTiming[];
  readonly result: BattleResultProbe | null;
}
