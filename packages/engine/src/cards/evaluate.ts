import { moveDef } from '../content/moves.js';
import type { MoveDef } from '../content/primitives.js';
import type { CardSkipReason } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import { lo } from '../rng/draws.js';
import { moveCost, moveDisabledByStatus, type StatusHolder } from '../status/apply.js';
import { holds } from './conditions.js';
import type { BattleView, Card, Deck, PendingCost } from './model.js';
import { resolveTarget } from './targets.js';

// Deck evaluation (spec §5 "Cards, decks and traces"): which card fires for the actor a BattleView was built
// for, the move and target it gives, and the trace of every card passed over. It reads the view only, so the
// same code serves battles (battle/plan.ts) and Eval Suite scenarios (B5).

/** Generalization bands (spec §5 "Generalization"): Robust ≥ 70, Stable 40–69, Brittle < 40. */
export type Band = 'robust' | 'stable' | 'brittle';
export const BAND_MIN = { robust: 70, stable: 40 } as const;
/** Obedience (spec §5, draw table D1 lo): a fired card is followed when lo(D1, 100) is below this. */
export const OBEDIENCE_PCT: Readonly<Record<Band, number>> = { robust: 100, stable: 95, brittle: 85 };

export function bandFor(g: number): Band {
  return g >= BAND_MIN.robust ? 'robust' : g >= BAND_MIN.stable ? 'stable' : 'brittle';
}

export function obeys(band: Band, d1: number): boolean {
  return lo(d1, 100) < OBEDIENCE_PCT[band];
}

export type CardSkip = { cardId: string; reason: CardSkipReason };
export type CardTrace = { firedCardId: string; skipped: CardSkip[] };

/**
 * The fired card, its move and target (null when nothing on the field is a legal target for it: the caller
 * falls back), the trace, whether a Brittle repeat replaced the Default move, and `obeying`: when the obedience
 * roll failed, the card the actor would have used had it obeyed (its id, move and target), else null — so the
 * caller can tell a re-plan from a disobedience (Ruling 92, battle/plan.ts deckAction). `fallback` (Rulings 86, 88): a held status forbids the Default move (or the Brittle repeat
 * move), so nothing fires — the Default card is traced `moveDisabled`, `moveId` is the forbidden move, `target` is
 * null, and the caller uses the creature's no-deck default intent (its first move a status allows, at that move's
 * default selector). The trace still names the Default card as `firedCardId`, its slot in the deck.
 */
export type Evaluation = {
  cardId: string;
  moveId: string;
  target: number | null;
  trace: CardTrace;
  brittleRepeat: boolean;
  fallback: boolean;
  obeying: { cardId: string; moveId: string; target: number } | null;
};

/**
 * - `startAfter`: begin below that card (Default when it is the last card).
 * - `resume`: re-validate an intent at resolution — begin AT its card, which fires again only while its condition
 *   holds, its move is usable and its plan-time `target` is still legal (Ruling 85: a randomFoe pick is kept, not
 *   redrawn); otherwise evaluation continues from the next card down; a resumed Default re-aims when its target is gone.
 * - `d1`: roll obedience with this draw (at resolution); without it the obeying choice is returned (the intent).
 * - `policies`: Policy Update cards in force (spec §5 "Orchestrator levers"), evaluated above the deck's cards like any
 *   card (traced with their own ids) and always active — they use no card slot; one whose move the actor does not
 *   know (not in `knownMoves`) is traced `moveDisabled`. They never count towards a Brittle repeat.
 */
export type EvaluateOptions = {
  band: Band;
  startAfter?: string;
  resume?: { cardId: string; target: number };
  d1?: number;
  policies?: { cards: readonly Card[]; knownMoves: readonly string[] };
};

/** The cells a move costing `cost` pays with these pending modifiers: costSet replaces it (the last wins), then each costAdd adds. */
export function cellsWithPending(cost: number, mods: readonly PendingCost[]): number {
  let cells = cost;
  for (const m of mods) if (m.kind === 'costSet') cells = m.cells;
  for (const m of mods) if (m.kind === 'costAdd') cells += m.cells;
  return cells;
}

/** The actor as the status rules see it (statuses by id; Drift is the context's, not a status). */
function holderOf(view: BattleView): StatusHolder {
  const s = view.self;
  return { index: s.index, isOrchestrator: s.isOrchestrator, stages: { ...s.stages }, statuses: s.statuses.filter((id) => id !== 'drift').map((id) => ({ id, remaining: 1 })) };
}

const aimsAtUser = (def: MoveDef): boolean => def.target === 'self' || def.target === 'none';

/** Whether `t` is a living creature among `cs`. */
function livingIn(cs: BattleView['foes'], t: number): boolean {
  for (const c of cs) if (c.index === t && c.hp > 0) return true;
  return false;
}

/** Whether `t` is a living on-field creature of the kind the move aims at (self/none moves accept anything). */
function legalIn(view: BattleView, def: MoveDef, t: number): boolean {
  if (aimsAtUser(def)) return true;
  if (def.target === 'ally') return (t === view.self.index && view.self.hp > 0) || livingIn(view.allies, t);
  if (def.target === 'other') return livingIn(view.allies, t) || livingIn(view.foes, t);
  return livingIn(view.foes, t);
}

type Verdict = { fires: true; target: number } | { fires: false; reason: CardSkipReason };

/**
 * One active card: its condition must hold, its move must not be forbidden by a held status (Overfit reads
 * lastMoveId), its cost (pending modifiers, then Quantized) must fit the free cells unless `allowOverflow`, and it
 * needs a legal target — `keep` when resuming, else its selector's pick (self/none moves aim at the actor).
 * `holder` is the actor as the status rules see it (holderOf), built once per evaluation.
 */
function judge(card: Card, view: BattleView, holder: StatusHolder, keep: number | undefined): Verdict {
  if (!holds(card, view)) return { fires: false, reason: 'conditionFalse' };
  const def = moveDef(card.move);
  if (def === null || moveDisabledByStatus(holder, def, view.lastMoveId)) return { fires: false, reason: 'moveDisabled' };
  const free = view.self.contextWindow - view.self.contextUsed;
  if (card.allowOverflow !== true && moveCost(holder, cellsWithPending(def.cost, view.pendingCost)) > free) return { fires: false, reason: 'insufficientContext' };
  const target = aimsAtUser(def) ? view.self.index : (keep ?? resolveTarget(card.target, view, card.move));
  return target !== null && legalIn(view, def, target) ? { fires: true, target } : { fires: false, reason: 'conditionFalse' };
}

/**
 * Where the Default card aims `moveId`: `keep` while legal, else `card`'s selector, else the move's own default
 * (the lowest-HP ally for ally moves, the lowest-HP foe otherwise); null when nothing is legal.
 */
function defaultAim(view: BattleView, card: Card, moveId: string, keep: number | undefined): number | null {
  const def = moveDef(moveId);
  if (def === null) return null;
  if (aimsAtUser(def)) return view.self.index;
  for (const t of [keep, resolveTarget(card.target, view, moveId), resolveTarget(def.target === 'ally' ? 'lowestHpAlly' : 'lowestHpFoe', view, moveId)]) {
    if (t !== undefined && t !== null && legalIn(view, def, t)) return t;
  }
  return null;
}

/** Brittle repeat: the first card (deck order) holding the move most represented among the deck's cards; null with none. */
function mostRepresented(deck: Deck): Card | null {
  let pick: { card: Card; count: number } | null = null;
  for (const card of deck.cards) {
    const count = deck.cards.filter((c) => c.move === card.move).length;
    if (pick === null || count > pick.count) pick = { card, count };
  }
  return pick?.card ?? null;
}

/** The position of card `id` among `cards` (policies, then the deck's cards): its index, or `cards.length` for the Default card. */
function positionOf(cards: readonly Card[], deck: Deck, id: string): number {
  if (id === deck.default.id) return cards.length;
  const at = cards.findIndex((c) => c.id === id);
  if (at < 0) throw new EngineInvariantError(`card ${id} is not in the deck`, {});
  return at;
}

/**
 * Evaluates `deck` top-down for the view's actor (spec §5): any policy cards first (always active), then the deck's
 * cards, those at deck positions ≥ `activeN` traced `notActive`; an active card fires per `judge`, else it is
 * traced with the reason. With `d1`, the first card that
 * fires is followed only when the actor `obeys`; otherwise it is traced `disobeyed` and the next card below that
 * fires is used, with no second roll. When no card above fires, Default does — unless the actor is Brittle, has
 * cards and disobeyed none of them: then it repeats its most-represented move (`brittleRepeat`), aimed by the first
 * card holding it. Default is never disobeyed and ignores its condition and the free cells (see Deck), but when a
 * held status forbids its move (or the repeat move) the result is a `fallback` (Rulings 86, 88).
 */
export function evaluateDeck(deck: Deck, view: BattleView, activeN: number, opts: EvaluateOptions): Evaluation {
  const skipped: CardSkip[] = [];
  const policies = opts.policies?.cards ?? [];
  const cards = [...policies, ...deck.cards];
  const active = activeN + policies.length;
  const resumeAt = opts.resume === undefined ? -1 : positionOf(cards, deck, opts.resume.cardId);
  const start = resumeAt >= 0 ? resumeAt : opts.startAfter === undefined ? 0 : positionOf(cards, deck, opts.startAfter) + 1;
  const holder = holderOf(view);
  let rolled = false;
  let obeying: Evaluation['obeying'] = null;
  for (let i = start; i < cards.length; i++) {
    const card = cards[i] as Card;
    const unknown = i < policies.length && opts.policies?.knownMoves.includes(card.move) !== true;
    const v: Verdict =
      i >= active ? { fires: false, reason: 'notActive' } : unknown ? { fires: false, reason: 'moveDisabled' } : judge(card, view, holder, i === resumeAt ? opts.resume?.target : undefined);
    if (!v.fires) {
      skipped.push({ cardId: card.id, reason: v.reason });
      continue;
    }
    if (opts.d1 !== undefined && !rolled) {
      rolled = true;
      if (!obeys(opts.band, opts.d1)) {
        obeying = { cardId: card.id, moveId: card.move, target: v.target };
        skipped.push({ cardId: card.id, reason: 'disobeyed' });
        continue;
      }
    }
    return { cardId: card.id, moveId: card.move, target: v.target, trace: { firedCardId: card.id, skipped }, brittleRepeat: false, fallback: false, obeying };
  }
  const keep = resumeAt === cards.length ? opts.resume?.target : undefined;
  const repeat = opts.band === 'brittle' && obeying === null ? mostRepresented(deck) : null;
  const moveId = repeat?.move ?? deck.default.move;
  const trace = { firedCardId: deck.default.id, skipped };
  const def = moveDef(moveId);
  if (def === null || moveDisabledByStatus(holder, def, view.lastMoveId)) {
    skipped.push({ cardId: deck.default.id, reason: 'moveDisabled' });
    return { cardId: deck.default.id, moveId, target: null, trace, brittleRepeat: false, fallback: true, obeying };
  }
  const target = defaultAim(view, repeat ?? deck.default, moveId, keep);
  return { cardId: deck.default.id, moveId, target, trace, brittleRepeat: repeat !== null, fallback: false, obeying };
}
