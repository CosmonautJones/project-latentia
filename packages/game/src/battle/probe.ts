// What the dev hook (`window.__latentia.battle()`) can see of the running battle: enough for Playwright to drive the
// menus and to check that a result arrives, and for P4 to pick up the loss summary. Plain data only.

import type { Temperature } from '@latentia/engine';
import type { BattleId } from '../content/battles.js';
import type { Outcome } from './session.js';
import type { Speed } from './timeline.js';

export type BattlePhase = 'intro' | 'command' | 'playback' | 'why' | 'result';

export interface BattleResultProbe {
  readonly outcome: Outcome;
  readonly rounds: number;
  /** What each deck-driven creature kept doing (card-text summarizeTraces). */
  readonly traceSummary: readonly string[];
}

export interface BattleProbe {
  readonly id: BattleId;
  readonly phase: BattlePhase;
  readonly round: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
  readonly moves: readonly { readonly moveId: string; readonly cost: number; readonly affordable: boolean; readonly damaging: boolean }[];
  /** The intent preview lines on screen. */
  readonly intents: readonly string[];
  /** The "why?" popup's text for the latest traces, or null before any deck-driven action. */
  readonly why: string | null;
  /** Wall-clock milliseconds each round's playback took, in order. */
  readonly roundMs: readonly number[];
  readonly result: BattleResultProbe | null;
}
