// The only public surface of @latentia/engine: the Phase A subset of spec §4 (B2 adds getIntents,
// B5 adds computeGeneralization). Everything else in src/ is internal.

export { ENGINE_VERSION } from './battle/log.js';
export type { BattleLog, OrchestratorAction, RoundCommand, SideCommand } from './battle/log.js';

export { createBattle, validateSetup } from './battle/setup.js';
export type { BattleSetup, CreatureSetup, SetupError, SideSetup, ValidationError, ValidationResult } from './battle/setup.js';

export { submitRound } from './battle/round.js';
export type { CommandError } from './battle/errors.js';

export { simulate } from './battle/simulate.js';
export type { BattleResult, CommandSource, SimulateError } from './battle/simulate.js';

export { replay } from './battle/replay.js';
export type { ReplayError } from './battle/replay.js';

export type { BattleState, Card, CreatureState, Deck, FieldState, Outcome, SideId, SideState, SlotState, Temperature, Version } from './battle/state.js';

export { validateGrid } from './grid/validate.js';
export type { GridError } from './grid/validate.js';
export { activeCardCount } from './grid/adjacency.js';
export type { Cell, GridLayout, PieceKind, PlacedPiece, Rotation } from './grid/model.js';

export { eventStreamHash } from './events/canonical.js';
export { fnv1a64Hex } from './events/fnv.js';
export type { BattleEvent, BattleEventType, CardSkipReason, RawDraws, SkipReason } from './events/types.js';

export type { SeedHex } from './rng/seed.js';
export type { EngineInvariantError } from './math/bp.js';
