// The only public surface of @latentia/engine: spec §4 so far (B2 added getIntents; B5 adds
// computeGeneralization), plus the thrown error classes as values for instanceof (Ruling 67), and, read-only
// (frozen), the content catalogs and the deck-editor constants a client needs (Ruling 119 m3), and the grid-size
// table (C2 fix round 1, for the sim's starter grid).
// Everything else in src/ is internal.

export { ENGINE_VERSION } from './battle/log.js';
export type { BattleLog, OrchestratorAction, RoundCommand, SideCommand } from './battle/log.js';

export { createBattle, SetupError, validateSetup } from './battle/setup.js';
export type { BattleSetup, CreatureSetup, SideSetup, ValidationError, ValidationErrorCode, ValidationResult } from './battle/setup.js';
export { MAX_AUTOPILOT_CARDS, MAX_DECK_CARDS } from './battle/validate-deck.js';

export { submitRound } from './battle/round.js';
export { getIntents } from './battle/intents.js';
export type { Intent } from './battle/intents.js';
export type { CommandError } from './battle/errors.js';

export { simulate, SimulateError } from './battle/simulate.js';
export type { BattleResult, CommandSource } from './battle/simulate.js';

export { replay } from './battle/replay.js';
export type { ReplayError } from './battle/replay.js';

export type { BattleState, CreatureState, DirectiveState, FieldState, Outcome, PolicyState, SideId, SideState, SlotState, Temperature, Version } from './battle/state.js';

export type { BattleView, Card, Condition, ConditionCategory, Deck, FieldKind, PendingCost, Subject, TargetSelector, Threshold, ViewCreature } from './cards/model.js';
export { CONDITION_CATEGORIES, TARGET_SELECTORS } from './cards/model.js';
export type { Band } from './cards/evaluate.js';
export { BAND_MIN, bandFor } from './cards/evaluate.js';

export { LAUNCH_MOVE_IDS, MOVES, moveDef, SIGNATURE_MOVE_IDS } from './content/moves.js';
export type { MoveId } from './content/moves.js';
export type { MoveDef } from './content/primitives.js';
export { SPECIES, SPECIES_IDS } from './content/species.js';
export type { SpeciesDef, SpeciesId } from './content/species.js';
export { STATUSES, STATUS_IDS } from './content/statuses.js';
export type { StatusDef } from './content/statuses.js';
export { TYPES } from './content/ids.js';
export type { StatusId, TypeId } from './content/ids.js';
export { TYPE_CHART_BP, typeMultiplierBp } from './content/types.js';

export { computeGeneralization } from './generalization/score.js';
export { GeneralizationError } from './generalization/errors.js';
export type { GeneralizationErrorCode } from './generalization/errors.js';
export { DEPRECATED_FOREST_SUITE } from './generalization/suites/deprecated-forest.js';
export type { EvalScenario, EvalSuite, GeneralizationReport, WastefulRule } from './generalization/model.js';

export { validateGrid } from './grid/validate.js';
export type { GridError } from './grid/validate.js';
export { activeCardCount } from './grid/adjacency.js';
export { GRID_SIZE_BY_LEVEL, gridSizeFor } from './grid/model.js';
export type { Cell, GridLayout, PieceKind, PlacedPiece, Rotation } from './grid/model.js';

export { eventStreamHash } from './events/canonical.js';
export { fnv1a64Hex } from './events/fnv.js';
export type { BattleEvent, BattleEventType, CardSkipReason, CardTraceEvent as CardTrace, RawDraws, SkipReason } from './events/types.js';

export type { SeedHex } from './rng/seed.js';
export { EngineInvariantError } from './math/bp.js';
