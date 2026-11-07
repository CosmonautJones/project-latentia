import type { SeedHex } from '../rng/seed.js';
import type { BattleSetup } from './setup.js';
import type { Card, Temperature } from './state.js';

/** The orchestrator's action for a round. Targets and subagents are canonical indices. */
export type OrchestratorAction =
  | { kind: 'move'; moveId: string; target: number; injection?: { moveId: string; target: number } }
  | { kind: 'directive'; subagent: number; moveId: string; target: number }
  | { kind: 'policyUpdate'; card: Card }
  | { kind: 'swap'; out: number; in: number }
  | { kind: 'none' };

export type SideCommand = { temperature: Temperature; action: OrchestratorAction };

/** One round's inputs. Autopilot sides omit theirs. */
export type RoundCommand = { a?: SideCommand; b?: SideCommand };

/** Inputs only; events are derived by replay (spec §5 "Events, logs and hashing"). */
export type BattleLog = { engineVersion: string; seed: SeedHex; setup: BattleSetup; rounds: RoundCommand[] };
