// Dependency-free: ids are plain strings, creature references are canonical indices.
// Every event carries `round` and a `type` discriminant. Fields are integers,
// strings, booleans, arrays or plain objects only (they are canonical-JSON hashed).

export type SkipReason =
  | 'rateLimited'
  | 'cleared'
  | 'headless'
  | 'fainted'
  | 'leftField'
  | 'charging';

export type CardSkipReason =
  | 'conditionFalse'
  | 'insufficientContext'
  | 'moveDisabled'
  | 'notActive'
  | 'disobeyed';

export interface RawDraws {
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  d6: number;
}

interface Base {
  round: number;
}

export type BattleEvent =
  | (Base & { type: 'RoundStart' })
  | (Base & { type: 'IntentsPlanned'; intents: { actor: number; moveId: string; target: number; cardId: string | null }[] })
  | (Base & { type: 'ActionStarted'; actor: number; draws: RawDraws })
  | (Base & {
      type: 'CardTrace';
      actor: number;
      firedCardId: string;
      skipped: { cardId: string; reason: CardSkipReason }[];
    })
  | (Base & { type: 'MoveUsed'; actor: number; moveId: string; target: number })
  | (Base & { type: 'Missed'; actor: number; target: number })
  | (Base & { type: 'Damage'; actor: number; target: number; amount: number; hpAfter: number })
  | (Base & { type: 'Crit'; actor: number; target: number })
  | (Base & { type: 'TypeEffect'; actor: number; target: number; multiplierBp: number })
  | (Base & { type: 'StatusApplied'; target: number; status: string; rounds: number })
  | (Base & { type: 'StatusBlocked'; target: number; status: string })
  | (Base & { type: 'StatusExpired'; target: number; status: string })
  | (Base & { type: 'StatusCured'; target: number; status: string })
  | (Base & { type: 'StageChanged'; target: number; stat: string; delta: number; stageAfter: number })
  | (Base & { type: 'StageStolen'; actor: number; target: number; stat: string; amount: number })
  | (Base & { type: 'Healed'; target: number; amount: number; hpAfter: number })
  | (Base & { type: 'ActionSkipped'; actor: number; reason: SkipReason })
  | (Base & { type: 'GuardResolved'; actor: number; target: number; kind: string; blocked: boolean })
  | (Base & { type: 'ShieldAbsorbed'; target: number; hitsLeft: number })
  | (Base & { type: 'FieldEffectStarted'; effect: string; side: number; target: number; rounds: number })
  | (Base & { type: 'FieldEffectEnded'; effect: string; side: number; target: number })
  | (Base & { type: 'Revealed'; actor: number; target: number; what: string })
  | (Base & { type: 'ContextAdded'; target: number; kind: string; tokens: number; tokensAfter: number })
  | (Base & { type: 'DriftChanged'; target: number; drift: number })
  | (Base & { type: 'Compacted'; target: number; tokensBefore: number; tokensAfter: number })
  | (Base & { type: 'PieceCompacted'; target: number; pieceId: string })
  | (Base & { type: 'ObservationGained'; target: number; observation: string })
  | (Base & { type: 'HandoffChain'; actor: number; chain: number[] })
  | (Base & { type: 'Swapped'; side: number; outIndex: number; inIndex: number })
  | (Base & { type: 'Fainted'; target: number })
  | (Base & { type: 'HeadlessMode'; side: number; active: boolean })
  | (Base & { type: 'BrittleRepeat'; actor: number; moveId: string })
  | (Base & { type: 'RoundEnd' })
  | (Base & { type: 'BattleEnd'; winner: number | null; reason: string });

export type BattleEventType = BattleEvent['type'];

/** The CardTrace event: which deck card fired for a deck-driven action, and why each card above it was skipped. */
export type CardTraceEvent = Extract<BattleEvent, { type: 'CardTrace' }>;
