import type { StatusId, TypeId } from '../content/ids.js';
import type { FieldEffect, StageStat } from '../content/primitives.js';

// The card grammar (spec §5 "Cards, decks and traces"; bible "Training is example cards"). Cards and decks
// are plain JSON-compatible data: they live in the setup and are cloned into the battle state. Every field is
// an enum or an id — no free text. A card reads `IF <subject> <condition> THEN <move> [target]`.

/** Percent thresholds come in 25 / 50 / 75 only; `below` is `<`, `atLeast` is `≥`, by cross-multiplication. */
export type Threshold = { op: 'below' | 'atLeast'; pct: 25 | 50 | 75 };

/** Who a condition reads: the actor, its side's orchestrator, or any living on-field foe. */
export type Subject = 'self' | 'orchestrator' | 'foe';

export const SUBJECTS: readonly Subject[] = ['self', 'orchestrator', 'foe'];

/** The kind of a timed field effect a creature can hold (FieldState.effect.kind). */
export type FieldKind = FieldEffect['kind'] | 'revealTopDeckCard';

/** Every FieldKind, for shape checks; the record makes the type checker keep it complete. */
const FIELD_KIND_SET: Record<FieldKind, true> = {
  junkPerRound: true,
  revealIntents: true,
  accuracyStages: true,
  forceTemperature: true,
  critStagesAgainst: true,
  revealTopDeckCard: true,
};
export const FIELD_KINDS = Object.keys(FIELD_KIND_SET) as readonly FieldKind[];

/**
 * The bible's 12 condition categories. Subject categories read the subject creature (for `foe`: true when ANY
 * living on-field foe matches; a KO'd subject never matches). Actor categories read the actor or the battle
 * and ignore the subject.
 */
export type Condition =
  /** Subject: hp × 100 against maxHp × pct. */
  | ({ category: 'hp' } & Threshold)
  /** Subject: holds the status. `drift` holds while the subject has at least one Drift stack. */
  | { category: 'status'; status: StatusId }
  /** Subject: has the type, or (`weakToMove`) the card's move is super effective against it (> 10000 bp; a typeless move never is). */
  | { category: 'foeType'; is: TypeId | 'weakToMove' }
  /**
   * Subject: the most recent move it resolved this battle (any round) is `move` — the move that actually ran
   * (its moveHistory: after hallucination or Drift, a copy's copied move; Ruling 84).
   */
  | { category: 'foeLastMove'; move: string }
  /** Actor: the round being planned is below / atLeast `round` (a positive integer, not a percentage). */
  | { category: 'turn'; op: 'below' | 'atLeast'; round: number }
  /**
   * Actor: the engine has no move cooldowns, so a card imposes its own — true when the actor has not resolved the
   * card's move in any of the last `rounds` rounds (round − rounds … round − 1), or ever. It reads moveHistory, the
   * moves that actually ran (Ruling 84).
   */
  | { category: 'cooldown'; rounds: 1 | 2 | 3 }
  /** Actor: any living on-field ally other than the actor (its orchestrator included) has hp × 100 against maxHp × pct. */
  | ({ category: 'allyHp' } & Threshold)
  /** Subject: is the target (holder) of a live timed field effect of that kind. */
  | { category: 'field'; effect: FieldKind }
  /** Subject: holds a positive stage in any stat (held stages, before Quantized). */
  | { category: 'foeBuffed' }
  /** Subject: tokens held × 100 against its context window × pct (a zero window is full). */
  | ({ category: 'contextFill' } & Threshold)
  /** Subject: is charging a move whose charge is telegraphed (Deliberate; not Deep Research). */
  | { category: 'telegraphing' }
  /** Actor: the seeded coin, hi(R1, 2) === 1 of the actor's round-start draw; false with no draws. */
  | { category: 'coin' };

export type ConditionCategory = Condition['category'];

export const CONDITION_CATEGORIES: readonly ConditionCategory[] = [
  'hp',
  'status',
  'foeType',
  'foeLastMove',
  'turn',
  'cooldown',
  'allyHp',
  'field',
  'foeBuffed',
  'contextFill',
  'telegraphing',
  'coin',
];

/** The bible's 8 target selectors (resolveTarget). */
export type TargetSelector = 'self' | 'orchestrator' | 'lowestHpAlly' | 'orchestratorTarget' | 'lowestHpFoe' | 'foeWeakToMove' | 'highestAtkFoe' | 'randomFoe';

export const TARGET_SELECTORS: readonly TargetSelector[] = [
  'self',
  'orchestrator',
  'lowestHpAlly',
  'orchestratorTarget',
  'lowestHpFoe',
  'foeWeakToMove',
  'highestAtkFoe',
  'randomFoe',
];

/**
 * One card. `move` must be a move the creature knows (checked by deck validation, B2). `allowOverflow` lets the
 * card fire when its move costs more cells than are free. `recordedFrom` is the opponent id the card was
 * recorded from (Specialist). `injection` is the Deepfake Call choice when the card's move inflicts Prompt Injected.
 */
export type Card = {
  id: string;
  subject: Subject;
  condition: Condition;
  move: string;
  target: TargetSelector;
  allowOverflow?: true;
  recordedFrom?: string;
  injection?: { moveId: string; target: TargetSelector };
};

/**
 * Active cards in priority order, then the non-removable Default card. Default fires whenever no card above it
 * does: its condition is not read, and it fires with too few free cells (overflow becomes Drift) or a move a
 * status forbids — a subagent never idles (bible "Training is example cards").
 */
export type Deck = { cards: Card[]; default: Card };

/** A pending cost modifier of the actor's next move (Embedding Cache's costSet, Token Nibble's costAdd). */
export type PendingCost = { readonly kind: 'costSet' | 'costAdd'; readonly cells: number };

/** One living creature as a card sees it: a plain-data projection (no references into the state). */
export type ViewCreature = {
  readonly index: number;
  readonly isOrchestrator: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly types: readonly TypeId[];
  /** Held statuses in held order, then `drift` while Drift has stacks. */
  readonly statuses: readonly StatusId[];
  /** Held stat stages (before Quantized). */
  readonly stages: Readonly<Record<StageStat, number>>;
  /** Effective Compute: the stat with its stage after Quantized (highestAtkFoe). */
  readonly compute: number;
  /** The most recent move it resolved (moveHistory), or null. */
  readonly lastMove: string | null;
  readonly telegraphing: boolean;
  /** Tokens held and the context window. */
  readonly contextUsed: number;
  readonly contextWindow: number;
  /** Kinds of the live field effects it holds, in the order they started. */
  readonly fields: readonly FieldKind[];
};

/**
 * What one creature's cards see when it plans a round (built by battle/view.ts `viewFor`, or authored as data for
 * Eval Suite scenarios). Lists are in canonical (ascending index) order and hold living on-field creatures only,
 * so a KO'd or benched creature is never a subject or a target.
 */
export type BattleView = {
  /** The round being planned. */
  readonly round: number;
  /** The actor's round-start draws for that round (coin, randomFoe), or null when none are available. */
  readonly roundStart: { readonly r1: number; readonly r2: number } | null;
  /** The actor (it may be the orchestrator). */
  readonly self: ViewCreature;
  /** The actor's side's orchestrator (the actor itself when it is the orchestrator); null once KO'd. */
  readonly orchestrator: ViewCreature | null;
  /** Living on-field allies other than the actor, orchestrator included. */
  readonly allies: readonly ViewCreature[];
  /** Living on-field foes, orchestrator included. */
  readonly foes: readonly ViewCreature[];
  /** The canonical index the allied orchestrator is aiming at (a living on-field foe), or null. */
  readonly orchestratorTarget: number | null;
  /** The last round the actor resolved each move (moveHistory), one entry per move, in first-use order (cooldown). */
  readonly selfLastUsed: readonly { readonly moveId: string; readonly round: number }[];
  /** The move the actor itself last chose (CreatureState.lastMoveId: the copy move, not the copied one), which Overfit locks. */
  readonly lastMoveId: string | null;
  /** The actor's pending costSet / costAdd modifiers, oldest first: its next move pays with them (Ruling 84). */
  readonly pendingCost: readonly PendingCost[];
};
