import type { SeedHex } from '../rng/seed.js';
import type { BattleSetup } from './setup.js';
import type { Card } from '../cards/model.js';
import type { Temperature } from './state.js';

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

/** Semver of the rules and content; bumps on any change to them (spec §4). A log records the version that wrote it. */
export const ENGINE_VERSION = '0.4.0';

/** Inputs only; events are derived by replay (spec §5 "Events, logs and hashing"). */
export type BattleLog = { engineVersion: string; seed: SeedHex; setup: BattleSetup; rounds: RoundCommand[] };
