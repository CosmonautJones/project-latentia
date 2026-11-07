import type { StatusId, TypeId } from './ids.js';

// Effect primitives (spec §6). Every move, signature and passive is plain data built from
// this closed union: no functions, integers only (percent or basis points as named), and
// every random decision names the draw slot it reads (spec §5 draw table).

export const DRAW_SLOTS = [
  'd1lo', 'd1hi', 'd2lo', 'd2hi', 'd3lo', 'd3hi', 'd4lo', 'd4hi', 'd5lo', 'd5hi', 'd6lo', 'd6hi', 'r2hi',
] as const;
export type DrawSlot = (typeof DRAW_SLOTS)[number];

/** A percent check: passes when the slot's value mod 100 is `< pct`. Move riders use d6lo; passive procs use r2hi. */
export interface Chance {
  readonly pct: number;
  readonly slot: DrawSlot;
}

/**
 * Who an effect lands on, relative to the acting creature. `target` is the move's chosen target.
 * `allAllies` is every on-field creature of the user's side, the user included; `allFoes` every
 * on-field foe; `everyone` every on-field creature.
 */
export type Who = 'target' | 'self' | 'allAllies' | 'allFoes' | 'everyone';

/** Stats that carry stages (−3…+3). Accuracy and evasion stages are worth 10 accuracy points each. */
export type StageStat = 'compute' | 'robustness' | 'latency' | 'accuracy' | 'evasion';

/** Battle-state tests used by conditional effects. Comparisons are integer cross-multiplications. */
export type Condition =
  | { readonly kind: 'targetHasStatus'; readonly status: StatusId }
  /** True if the target did any of these in the previous round. */
  | { readonly kind: 'targetLastRound'; readonly did: readonly ('buffed' | 'usedStatusMove')[] }
  /** user hp × target max > target hp × user max. */
  | { readonly kind: 'userHpPctAboveTarget' }
  /** The move's type is super-effective against the target (chart product > 10000). */
  | { readonly kind: 'targetWeakToMove' }
  | { readonly kind: 'targetActedThisRound' };

export type Counter =
  /** Immediately preceding consecutive rounds in which the user used a move of this type. */
  | { readonly kind: 'userConsecutiveRoundsUsingType'; readonly type: TypeId }
  /** Hits the user has taken from the target this battle. */
  | { readonly kind: 'hitsTakenFromTarget' };

/** Additive power bonus (spec §5 damage step 1, before multipliers). */
export type PowerBonus =
  /** + per × count, capped: `of: 'bonus'` caps the bonus, `of: 'power'` caps base + bonus. */
  | { readonly kind: 'perCount'; readonly counter: Counter; readonly per: number; readonly cap: { readonly of: 'bonus' | 'power'; readonly value: number } }
  | { readonly kind: 'flat'; readonly add: number; readonly when: Condition };

/** Conditional power multiplier in basis points; unconditional when `when` is absent. */
export interface PowerMult {
  readonly bp: number;
  readonly when?: Condition;
}

export type CritRule =
  | { readonly kind: 'stages'; readonly stages: number }
  | { readonly kind: 'never' }
  | { readonly kind: 'always'; readonly when: Condition };

export type HitCount =
  /** min + hi(slot, max − min + 1) hits. */
  | { readonly kind: 'range'; readonly min: number; readonly max: number; readonly slot: 'd5hi' }
  /** base + number of other on-field allies of `type`. */
  | { readonly kind: 'perAllyOfType'; readonly base: number; readonly type: TypeId };

/** Timed field effects (spec §6 `timedField`); each ticks at end of round. */
export type FieldEffect =
  | { readonly kind: 'junkPerRound'; readonly count: number }
  | { readonly kind: 'revealIntents' }
  | { readonly kind: 'accuracyStages'; readonly delta: number }
  | { readonly kind: 'forceTemperature'; readonly temperature: 0 | 1 | 2 | 3 | 4 }
  /** Attacks from the user's side against the holder get extra crit stages. */
  | { readonly kind: 'critStagesAgainst'; readonly delta: number };

/** Modifies the holder's next action (or, for `incomingDamageBp`, the next hit it takes), then expires. */
export type NextActionMod =
  | { readonly kind: 'powerBp'; readonly bp: number }
  | { readonly kind: 'incomingDamageBp'; readonly bp: number }
  | { readonly kind: 'fail' }
  | { readonly kind: 'cannotMiss' }
  | { readonly kind: 'ignoreEvasion' }
  | { readonly kind: 'accuracy'; readonly delta: number }
  | { readonly kind: 'priority'; readonly delta: number }
  | { readonly kind: 'costSet'; readonly cells: number }
  | { readonly kind: 'costAdd'; readonly cells: number }
  /** Skips the holder's next orchestrator command (spec §5 /clear); a no-op when the holder is not an orchestrator. */
  | { readonly kind: 'skip'; readonly reason: 'cleared'; readonly scope: 'orchestratorCommand' };

export type GuardKind = 'guardrail' | 'refusal' | 'unitTest' | 'captchaWall';

/**
 * When a species passive fires.
 * - `battleStart`: at battle creation. A `nextActionModifier` it applies (e.g. `priority`) is consumed by
 *   that creature's first action, so a priority modifier takes effect at its first Sort.
 * - `afterFirstAction`: after the creature's first action of the battle resolves; its effects can read
 *   that action's dealt damage, and its chance procs read that round's `r2hi`.
 * - `roundEnd`: at end of every round. `statusIncoming`: when a status is about to be applied to the
 *   creature. `notKoThisRound`: at end of every round in which the creature was not KO'd.
 */
export type PassiveTrigger = 'battleStart' | 'afterFirstAction' | 'roundEnd' | 'statusIncoming' | 'notKoThisRound';

/** Optional on every effect except `passive`: the effect applies only if the check passes. */
interface Base {
  readonly chance?: Chance;
}

/** Every effect a move or a passive can apply (moves never carry passives). */
export type NonPassiveEffect =
  /** Damage from the move's power (spec §5 damage), with typed conditional power. */
  | (Base & {
      readonly kind: 'damage';
      readonly who: 'target';
      readonly bonus?: PowerBonus;
      readonly mult?: readonly PowerMult[];
      readonly crit?: CritRule;
      readonly failsIf?: Condition;
      readonly ignoreUserComputeDrops?: true;
    })
  /** Recoil: the user takes pct% of the damage this action dealt. */
  | (Base & { readonly kind: 'damage'; readonly who: 'self'; readonly pctOfDealt: number })
  /** Hits `count` times at the move's power each; one accuracy, crit and roll for all hits (spec §5 step 7). */
  | (Base & { readonly kind: 'multiHit'; readonly who: 'target'; readonly count: HitCount })
  /** The first use only charges; the move's remaining effects resolve `rounds` later. */
  | (Base & {
      readonly kind: 'charge';
      readonly who: 'self';
      readonly rounds: number;
      readonly telegraphed: boolean;
      /** Power delta applied if the user is hit while charging (Deliberate −30). */
      readonly hitWhileChargingPower: number;
    })
  /** Heals pct% of max HP. */
  | (Base & { readonly kind: 'heal'; readonly who: Who; readonly pct: number })
  | (Base & { readonly kind: 'stage'; readonly who: Who; readonly op: 'add'; readonly stat: StageStat; readonly delta: number })
  | (Base & { readonly kind: 'stage'; readonly who: Who; readonly op: 'clear'; readonly which: 'all' | 'positive' })
  /** Duration comes from STATUSES; a random duration reads `durationSlot`. */
  | (Base & { readonly kind: 'applyStatus'; readonly who: Who; readonly status: StatusId; readonly durationSlot?: 'd6hi' })
  /** Removes the listed statuses; for Drift, `driftStacks` stacks (all when absent). */
  | (Base & { readonly kind: 'cure'; readonly who: Who; readonly statuses: readonly StatusId[]; readonly driftStacks?: number })
  | (Base & { readonly kind: 'tokens'; readonly who: Who; readonly op: 'addJunk' | 'freeOldest'; readonly count: number })
  /** Pairs the `oldest` oldest tokens into summaries (spec §5 Compact). */
  | (Base & { readonly kind: 'tokens'; readonly who: 'self'; readonly op: 'compact'; readonly oldest: number })
  | (Base & { readonly kind: 'tokens'; readonly who: 'self'; readonly op: 'clear' })
  | (Base & { readonly kind: 'timedField'; readonly who: Who; readonly rounds: number; readonly field: FieldEffect })
  | (Base & { readonly kind: 'nextActionModifier'; readonly who: Who; readonly modifier: NextActionMod })
  /** Saves `what`; reverts it on the holder's first KO within `rounds`. */
  | (Base & { readonly kind: 'snapshot'; readonly who: Who; readonly what: 'hp' | 'stages'; readonly rounds: number; readonly revertOn: 'firstKo' })
  /** Restores the user's saved snapshot of `who`; with none held, takes one instead (Screenshot). */
  | (Base & { readonly kind: 'revert'; readonly who: Who; readonly what: 'hp' | 'stages'; readonly ifNone: 'snapshot' })
  | (Base & { readonly kind: 'reveal'; readonly who: Who; readonly what: 'nextIntent' | 'topDeckCard'; readonly rounds: number })
  /** Swaps the user's and the target's entries in this round's turn order. */
  | (Base & { readonly kind: 'reorder'; readonly who: 'target'; readonly what: 'turnOrder' })
  /** Swaps the user out for the first living bench creature (spec §5 Levers, Early Exit). */
  | (Base & { readonly kind: 'reorder'; readonly who: 'self'; readonly what: 'fieldSlot'; readonly incoming: 'firstLivingBench' })
  /** The user copies the target's highest positive stage. */
  | (Base & { readonly kind: 'copy'; readonly who: 'self'; readonly what: 'buff'; readonly from: 'target'; readonly pick: 'best'; readonly mode: 'copy' })
  /** The user and target exchange one randomly picked positive stage. */
  | (Base & { readonly kind: 'copy'; readonly who: 'self'; readonly what: 'buff'; readonly from: 'target'; readonly pick: 'random'; readonly pickSlot: 'd6hi'; readonly mode: 'swap' })
  /** The user uses that move; on top of this move's own `cost`, it pays the copied cost + costOffset (min 0). */
  | (Base & { readonly kind: 'copy'; readonly who: 'self'; readonly what: 'move'; readonly from: 'lastAllyMove' | 'targetLastMove'; readonly costOffset: number })
  /**
   * Guards share one streak counter; success is lo(d3, 729) < [729, 243, 81, 27, 9, 3][k] (spec §5).
   * While up: incoming damage ×damageBp, status moves blocked, attacks blocked (optionally only of
   * one type, optionally only the first `limit`), or moves that hit the user last round reflected at reflectBp.
   */
  | (Base & {
      readonly kind: 'guard';
      readonly who: 'self';
      readonly guard: GuardKind;
      readonly successSlot: 'd3lo';
      readonly damageBp?: number;
      readonly blockStatusMoves?: true;
      readonly blockAttacks?: { readonly ofType?: TypeId; readonly limit?: number };
      readonly reflectBp?: number;
    })
  /** Absorbs the next `count` incoming hits or status applications. */
  | (Base & { readonly kind: 'shield'; readonly who: Who; readonly against: 'hit' | 'status'; readonly count: number })
  /** Moves `stages` of the target's highest positive stage (ties: StageStat order) to the user. */
  | (Base & { readonly kind: 'stealStage'; readonly who: 'target'; readonly pick: 'highest'; readonly stages: number });

/** Species passive: runs `effects` on the trigger (chance procs use slot r2hi). Passives never nest. */
export interface Passive {
  readonly kind: 'passive';
  readonly trigger: PassiveTrigger;
  readonly oncePerBattle?: true;
  readonly effects: readonly Exclude<Effect, { kind: 'passive' }>[];
}

export type Effect = NonPassiveEffect | Passive;

export type EffectKind = Effect['kind'];

export const EFFECT_KINDS = [
  'damage', 'multiHit', 'charge', 'heal', 'stage', 'applyStatus', 'cure', 'tokens', 'timedField', 'nextActionModifier',
  'snapshot', 'revert', 'reveal', 'reorder', 'copy', 'guard', 'shield', 'stealStage', 'passive',
] as const satisfies readonly EffectKind[];

/** Legal targets for a move. `ally` includes the user; `other` is any combatant but the user. */
export type MoveTarget =
  | 'foe'
  | 'ally'
  | 'self'
  | 'other'
  | 'none'
  /** Engine picks the foe this move would damage most (ties: canonical index). */
  | 'foeMostDamage'
  /** The living foe one canonical step before the chosen foe, wrapping (Off-By-Wasp). */
  | 'foeOffByOne';

/**
 * A move. `power` is per hit for multi-hit moves; null for moves that deal no move damage.
 * `accuracy` null means no accuracy check. `wild` is the full effect list used *instead of*
 * `effects` at T3 (and at T4 when `wildT4` is absent); `wildT4` replaces `wild` at T4. Nothing
 * doubles implicitly: every Wild value is written out.
 */
export interface MoveDef {
  readonly id: string;
  readonly name: string;
  readonly type: TypeId | 'system';
  readonly target: MoveTarget;
  readonly power: number | null;
  readonly cost: number;
  readonly accuracy: number | null;
  readonly priority: number;
  readonly effects: readonly NonPassiveEffect[];
  readonly wild?: readonly NonPassiveEffect[];
  readonly wildT4?: readonly NonPassiveEffect[];
  readonly universal?: true;
  readonly orchestratorOnly?: true;
}

/** Recursively freezes plain content data. */
export function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}
