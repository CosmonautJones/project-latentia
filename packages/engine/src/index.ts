// The only public surface of @latentia/engine: spec §4 so far (B2 added getIntents; B5 adds
// computeGeneralization), plus the thrown error classes as values for instanceof (Ruling 67).
// Everything else in src/ is internal.

export { ENGINE_VERSION } from './battle/log.js';
export type { BattleLog, OrchestratorAction, RoundCommand, SideCommand } from './battle/log.js';

export { createBattle, SetupError, validateSetup } from './battle/setup.js';
export type { BattleSetup, CreatureSetup, SideSetup, ValidationError, ValidationResult } from './battle/setup.js';

export { submitRound } from './battle/round.js';
export { getIntents } from './battle/plan.js';
export type { Intent } from './battle/plan.js';
export type { CommandError } from './battle/errors.js';

export { simulate, SimulateError } from './battle/simulate.js';
export type { BattleResult, CommandSource } from './battle/simulate.js';

export { replay } from './battle/replay.js';
export type { ReplayError } from './battle/replay.js';

export type { BattleState, CreatureState, FieldState, Outcome, SideId, SideState, SlotState, Temperature, Version } from './battle/state.js';

export type { Card, Condition, Deck, FieldKind, Subject, TargetSelector, Threshold } from './cards/model.js';

export { validateGrid } from './grid/validate.js';
export type { GridError } from './grid/validate.js';
export { activeCardCount } from './grid/adjacency.js';
export type { Cell, GridLayout, PieceKind, PlacedPiece, Rotation } from './grid/model.js';

export { eventStreamHash } from './events/canonical.js';
export { fnv1a64Hex } from './events/fnv.js';
export type { BattleEvent, BattleEventType, CardSkipReason, RawDraws, SkipReason } from './events/types.js';

export type { SeedHex } from './rng/seed.js';
export { EngineInvariantError } from './math/bp.js';
