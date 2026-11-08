import {
  CONDITION_CATEGORIES,
  moveDef,
  MOVES,
  SPECIES,
  STATUS_IDS,
  TARGET_SELECTORS,
  TYPES,
  type Card,
  type Condition,
  type ConditionCategory,
  type Deck,
  type FieldKind,
  type SideSetup,
  type SpeciesId,
  type Subject,
  type TargetSelector,
} from '@latentia/engine';
import { cardText, conditionText } from './card-text.js';
import type { Sfc32 } from './sfc32.js';
import type { Archetype } from './types.js';

// The deck search's mutations (Ruling 139 a, b): single changes to an Autopilot deck's cards, drawn from the engine's
// card grammar (its condition categories, statuses, types, target selectors) and the orchestrator's known moves.
// Ruling 141 narrows the draws to cards that can make sense: a foeLastMove condition names a move some foe in the field
// can use, a turn condition names a round a fight plausibly reaches (and never `below 1`), and a card's target
// selector aims where its move does (foe selectors for attacks, self or ally selectors for self, buff and heal moves).
// Every mutation builds a new deck — the cards it keeps are shared, never edited — and keeps the card count and the
// Default card. A mutation that would change nothing is no candidate; drawCandidate redraws it, and any candidate its
// validity check rejects, up to a cap.

export const MUTATIONS = ['replace', 'condition', 'move', 'reorder'] as const;
export type MutationKind = (typeof MUTATIONS)[number];

/** A candidate deck and what made it: card `index` changed (for a reorder, the card moved from `index` to `to`). */
export type Mutation = { kind: MutationKind; index: number; to: number; deck: Deck; label: string };

/** The grammar's subjects and field kinds; the records make the type checker keep the lists complete. */
const SUBJECT_SET: Record<Subject, true> = { self: true, orchestrator: true, foe: true };
const SUBJECTS = Object.keys(SUBJECT_SET) as Subject[];
const FIELD_KIND_SET: Record<FieldKind, true> = {
  junkPerRound: true,
  revealIntents: true,
  accuracyStages: true,
  forceTemperature: true,
  critStagesAgainst: true,
  revealTopDeckCard: true,
};
const FIELD_KINDS = Object.keys(FIELD_KIND_SET) as FieldKind[];
const OPS = ['below', 'atLeast'] as const;
const PCTS = [25, 50, 75] as const;
const COOLDOWNS = [1, 2, 3] as const;
/**
 * The highest round a `turn` condition names (Ruling 141): a plausible fight length — the round-robin's median fight is
 * 7 rounds, inside the 5–8 target band. `below` draws 2..TURN_MAX_ROUND (`below 1` never holds); `atLeast` draws
 * 1..TURN_MAX_ROUND (`atLeast 1` is the always-true card).
 */
export const TURN_MAX_ROUND = 10;
const UNIVERSAL_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.universal === true)
  .map((m) => m.id);

/**
 * The moves an Autopilot card may name: the orchestrator's stored moveset — its species' signature and its grid's
 * Skills and grafts (the listed moves of an ungridded one) — then the universal moves, without repeats.
 */
export function movePool(side: SideSetup): string[] {
  const own =
    side.grid === null
      ? side.orchestrator.moves
      : [SPECIES[side.orchestrator.species as SpeciesId].signature, ...side.grid.pieces.flatMap((p) => ((p.kind === 'skill' || p.kind === 'graft') && p.moveId !== undefined ? [p.moveId] : []))];
  return [...new Set([...own, ...UNIVERSAL_MOVE_IDS])];
}

/** What a mutation draws from: the moves the deck's cards may name, and the moves a foeLastMove condition may name. */
export type MutationPools = { moves: readonly string[]; foeMoves: readonly string[] };

/** `base`'s pools against `field`: its own movePool, and the union of movePool over the field's sides (Ruling 141). */
export function mutationPools(base: Archetype, field: readonly Archetype[]): MutationPools {
  return { moves: movePool(base.side), foeMoves: [...new Set(field.flatMap((f) => movePool(f.side)))] };
}

/** Which side a target selector names; the record keeps every selector classified. */
const SELECTOR_SIDE: Record<TargetSelector, 'ally' | 'foe'> = {
  self: 'ally',
  orchestrator: 'ally',
  lowestHpAlly: 'ally',
  orchestratorTarget: 'foe',
  lowestHpFoe: 'foe',
  foeWeakToMove: 'foe',
  highestAtkFoe: 'foe',
  randomFoe: 'foe',
};

/**
 * Where a move aims, read from its public move data the way the engine's default selector reads it: self and none
 * moves aim at the user and ally moves at an ally (both `ally`); foe kinds and `other` aim at a foe (`foe`).
 */
export function moveSide(moveId: string): 'ally' | 'foe' {
  const def = moveDef(moveId);
  if (def === null) throw new RangeError(`unknown move ${moveId}`);
  return def.target === 'self' || def.target === 'none' || def.target === 'ally' ? 'ally' : 'foe';
}

/** The target selectors a card naming `moveId` may use: those on the side the move aims at. */
export function selectorsFor(moveId: string): TargetSelector[] {
  const side = moveSide(moveId);
  return TARGET_SELECTORS.filter((t) => SELECTOR_SIDE[t] === side);
}

/** A condition drawn from the grammar: a category uniformly, then its parameters uniformly; foeLastMove names one of `foeMoves`. */
export function randomCondition(rng: Sfc32, foeMoves: readonly string[]): Condition {
  const category: ConditionCategory = rng.pick(CONDITION_CATEGORIES);
  switch (category) {
    case 'hp':
    case 'allyHp':
    case 'contextFill':
      return { category, op: rng.pick(OPS), pct: rng.pick(PCTS) };
    case 'status':
      return { category, status: rng.pick(STATUS_IDS) };
    case 'foeType':
      return { category, is: rng.below(TYPES.length + 1) === TYPES.length ? 'weakToMove' : rng.pick(TYPES) };
    case 'foeLastMove':
      return { category, move: rng.pick(foeMoves) };
    case 'turn': {
      const op = rng.pick(OPS);
      const low = op === 'below' ? 2 : 1;
      return { category, op, round: low + rng.below(TURN_MAX_ROUND - low + 1) };
    }
    case 'cooldown':
      return { category, rounds: rng.pick(COOLDOWNS) };
    case 'field':
      return { category, effect: rng.pick(FIELD_KINDS) };
    case 'foeBuffed':
    case 'telegraphing':
    case 'coin':
      return { category };
  }
}

const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);

/**
 * `card` naming `move` instead: its Deepfake Call `injection` belonged to the old move, so it is dropped, and a target
 * on the wrong side for the new move is redrawn from the move's selectors (Ruling 141).
 */
function withMove(card: Card, move: string, rng: Sfc32): Card {
  const targets = selectorsFor(move);
  const next: Card = { ...card, move, target: targets.includes(card.target) ? card.target : rng.pick(targets) };
  delete next.injection;
  return next;
}

/**
 * One mutation of `deck`, kind chosen uniformly: replace a card with a fresh one (id `freshId`; its target on the side
 * its move aims at), redraw a card's subject and condition, give a card another move from `pools.moves` (its target
 * redrawn only when on the wrong side), or move a card to another priority. Null when the draw changes nothing (or
 * cannot: one card, one move).
 */
export function mutate(deck: Deck, pools: MutationPools, rng: Sfc32, freshId: string): Mutation | null {
  const n = deck.cards.length;
  if (n === 0) return null;
  const kind = rng.pick(MUTATIONS);
  const index = rng.below(n);
  const old = deck.cards[index] as Card;
  const cards = [...deck.cards];
  let to = index;
  let label: string;
  if (kind === 'reorder') {
    if (n < 2) return null;
    to = rng.below(n - 1);
    if (to >= index) to++;
    cards.splice(index, 1);
    cards.splice(to, 0, old);
    label = `reorder #${index + 1} → #${to + 1} (${old.id})`;
  } else {
    let card: Card;
    if (kind === 'replace') {
      const move = rng.pick(pools.moves);
      card = { id: freshId, subject: rng.pick(SUBJECTS), condition: randomCondition(rng, pools.foeMoves), move, target: rng.pick(selectorsFor(move)) };
      label = `replace #${index + 1} (${old.id}) with ${freshId}: ${cardText(card)}`;
    } else if (kind === 'condition') {
      card = { ...old, subject: rng.pick(SUBJECTS), condition: randomCondition(rng, pools.foeMoves) };
      label = `condition of #${index + 1} (${old.id}): ${old.subject} ${conditionText(old.condition)} → ${card.subject} ${conditionText(card.condition)}`;
    } else {
      const others = pools.moves.filter((m) => m !== old.move);
      if (others.length === 0) return null;
      card = withMove(old, rng.pick(others), rng);
      label = `move of #${index + 1} (${old.id}): ${old.move} → ${card.move}${card.target === old.target ? '' : ` (target ${old.target} → ${card.target})`}`;
    }
    if (kind !== 'replace' && same(card, old)) return null;
    cards[index] = card;
  }
  return { kind, index, to, deck: { cards, default: deck.default }, label };
}

/**
 * A mutation of `deck` that `isValid` accepts: draws until one does, at most 1 + `maxRedraws` times. Redraws cost no
 * battles; null when the cap is reached (the search then stops rather than loop on an impossible state).
 */
export function drawCandidate(deck: Deck, pools: MutationPools, rng: Sfc32, freshId: string, isValid: (d: Deck) => boolean, maxRedraws: number): Mutation | null {
  for (let i = 0; i <= maxRedraws; i++) {
    const m = mutate(deck, pools, rng, freshId);
    if (m !== null && isValid(m.deck)) return m;
  }
  return null;
}
