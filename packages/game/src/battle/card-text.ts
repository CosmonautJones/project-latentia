// Cards and CardTraces in plain words, for the "why?" popup and the loss summary (bible: "not being able to see why
// a rule fired" is the gambit genre's main frustration). ASCII comparisons only: the pixel font has no ≥.

import type { Card, CardSkipReason, CardTrace, Condition, Deck, Subject } from '@latentia/engine';
import { fieldName, statusLabel, TYPE_NAMES } from './labels.js';

export type MoveNamer = (moveId: string) => string;

export interface TraceContext {
  name(index: number): string;
  moveName: MoveNamer;
  /** The deck a deck-driven creature plays from (its own, or its side's Autopilot), or null. */
  deckOf(index: number): Deck | null;
}

const SUBJECT: Readonly<Record<Subject, string>> = { self: 'own', foe: 'foe', orchestrator: 'orchestrator' };
const cmp = (op: 'below' | 'atLeast'): string => (op === 'below' ? '<' : '>=');
const typeName = (t: string): string => TYPE_NAMES[t as keyof typeof TYPE_NAMES] ?? t;

/** The condition as it reads after IF; null for the always-true `turn >= 1`, which reads as ALWAYS. */
function conditionText(subject: Subject, c: Condition, moveName: MoveNamer): string | null {
  const who = SUBJECT[subject];
  const be = subject === 'self' ? 'it is' : `${who} is`;
  switch (c.category) {
    case 'hp':
      return `${who} HP ${cmp(c.op)} ${c.pct}%`;
    case 'status':
      return `${be} ${statusLabel(c.status).name}`;
    case 'foeType':
      return c.is === 'weakToMove' ? `${be} weak to it` : `${be} ${typeName(c.is)} type`;
    case 'foeLastMove':
      return `${who === 'own' ? 'it' : who} last used ${moveName(c.move)}`;
    case 'turn':
      if (c.op === 'atLeast' && c.round <= 1) return null;
      if (c.op === 'below' && c.round === 2) return 'round 1';
      return `round ${cmp(c.op)} ${c.round}`;
    case 'cooldown':
      return `not used in the last ${c.rounds} round${c.rounds === 1 ? '' : 's'}`;
    case 'allyHp':
      return `an ally HP ${cmp(c.op)} ${c.pct}%`;
    case 'field':
      return `${who === 'own' ? 'it' : who} has ${fieldName(c.effect)}`;
    case 'foeBuffed':
      return `${be} buffed`;
    case 'contextFill':
      return `${who} context ${cmp(c.op)} ${c.pct}% full`;
    case 'telegraphing':
      return `${be} winding up`;
    case 'coin':
      return 'coin lands heads';
  }
}

/** Why a card's condition was false, in words: the opposite of its threshold, stated plainly. */
function negation(subject: Subject, c: Condition, moveName: MoveNamer): string {
  const foe = subject === 'foe';
  const who = SUBJECT[subject];
  /** The opposite of `op pct`: "below 50%" is false when it is "50%+", and the other way round. */
  const opposite = (op: 'below' | 'atLeast', pct: number) => (op === 'below' ? `${pct}%+` : `below ${pct}%`);
  switch (c.category) {
    case 'hp':
      return foe ? `no foe ${c.op === 'below' ? 'below' : 'at'} ${c.pct}%${c.op === 'below' ? '' : '+'} HP` : `${who} HP ${opposite(c.op, c.pct)}`;
    case 'status':
      return foe ? `no foe is ${statusLabel(c.status).name}` : `${subject === 'self' ? 'it is' : 'orchestrator is'} not ${statusLabel(c.status).name}`;
    case 'foeType':
      return c.is === 'weakToMove' ? (foe ? 'no foe is weak to it' : 'not weak to it') : foe ? `no foe is ${typeName(c.is)} type` : `not ${typeName(c.is)} type`;
    case 'foeLastMove':
      return foe ? `no foe last used ${moveName(c.move)}` : `its last move was not ${moveName(c.move)}`;
    case 'turn':
      return c.op === 'below' ? `it is past round ${c.round - 1}` : `it is before round ${c.round}`;
    case 'cooldown':
      return `used it in the last ${c.rounds} round${c.rounds === 1 ? '' : 's'}`;
    case 'allyHp':
      return `no ally ${c.op === 'below' ? 'below' : 'at'} ${c.pct}%${c.op === 'below' ? '' : '+'}`;
    case 'field':
      return foe ? `no foe has ${fieldName(c.effect)}` : `no ${fieldName(c.effect)}`;
    case 'foeBuffed':
      return foe ? 'no foe is buffed' : 'not buffed';
    case 'contextFill':
      return `${who} context ${opposite(c.op, c.pct)} full`;
    case 'telegraphing':
      return foe ? 'no foe is winding up' : 'not winding up';
    case 'coin':
      return 'the coin came up tails';
  }
}

/** Why a card did not fire because its condition was false: "no foe below 50% HP". */
export const conditionFalseText = (card: Card, moveName: MoveNamer): string => negation(card.subject, card.condition, moveName);

const SKIP_REASONS: Readonly<Record<Exclude<CardSkipReason, 'conditionFalse'>, string>> = {
  insufficientContext: 'not enough free context',
  moveDisabled: 'a status blocks that move',
  notActive: 'card not in an active slot',
  disobeyed: 'it ignored the card',
};

/** `IF <condition> THEN <Move>`, or `ALWAYS <Move>`. */
export function cardText(card: Card, moveName: MoveNamer): string {
  const cond = conditionText(card.subject, card.condition, moveName);
  return cond === null ? `ALWAYS ${moveName(card.move)}` : `IF ${cond} THEN ${moveName(card.move)}`;
}

const allCards = (deck: Deck): Card[] => [...deck.cards, deck.default];

function skipText(deck: Deck | null, cardId: string, reason: CardSkipReason, moveName: MoveNamer): string {
  const card = deck === null ? undefined : allCards(deck).find((k) => k.id === cardId);
  const label = card === undefined ? cardId : moveName(card.move);
  const why = reason === 'conditionFalse' ? (card === undefined ? 'condition false' : negation(card.subject, card.condition, moveName)) : SKIP_REASONS[reason];
  return `'${label}' (${why})`;
}

/** One CardTrace as a sentence: "Tokenibble fired 'IF foe HP < 50% THEN Token Nibble'; skipped 'X' (why)." */
export function explainTrace(trace: CardTrace, c: TraceContext): string {
  const deck = c.deckOf(trace.actor);
  const name = c.name(trace.actor);
  const fired = deck === null ? undefined : allCards(deck).find((k) => k.id === trace.firedCardId);
  const head =
    fired === undefined
      ? `${name} fired card '${trace.firedCardId}'`
      : deck !== null && fired === deck.default
        ? `${name} fell back to its Default, ${c.moveName(fired.move)}`
        : `${name} fired '${cardText(fired, c.moveName)}'`;
  const skips = trace.skipped.map((s) => skipText(deck, s.cardId, s.reason, c.moveName));
  return skips.length === 0 ? `${head}.` : `${head}; skipped ${skips.join(', ')}.`;
}
