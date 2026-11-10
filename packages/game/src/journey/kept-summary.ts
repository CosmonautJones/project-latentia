// The debrief's "Tokenibble kept ..." panel (plan step 8): a fight's CardTraces in plain words. Walks the event
// stream once, tracking HP, so each fired card is placed in context ("while you were under half HP"). Also the graft
// path's equivalent: how often you used the grafted move. Pure; ASCII only (the pixel font has no ≥).

import type { BattleEvent, Card, Deck } from '@latentia/engine';
import { cardText, conditionFalseText, type MoveNamer } from '../battle/card-text.js';
import { GRAFT_HINT } from '../content/journey-text.js';

export interface KeptCreature {
  readonly index: number;
  /** 0 = the player's side. */
  readonly side: 0 | 1;
  readonly isOrchestrator: boolean;
  /** HP at the start of the fight. */
  readonly hp: number;
  readonly maxHp: number;
  readonly name: string;
}

export interface KeptInput {
  readonly events: readonly BattleEvent[];
  readonly creatures: readonly KeptCreature[];
  readonly deckOf: (index: number) => Deck | null;
  readonly moveName: MoveNamer;
}

const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

interface Fired {
  readonly card: Card | undefined;
  readonly cardId: string;
  readonly youLow: boolean;
}

/** Every CardTrace of the player's deck-driven teammates, with whether your orchestrator was under half HP then. */
function firedCards(input: KeptInput): Map<number, Fired[]> {
  const hp = new Map(input.creatures.map((c) => [c.index, c.hp]));
  const maxHp = new Map(input.creatures.map((c) => [c.index, c.maxHp]));
  const you = input.creatures.find((c) => c.side === 0 && c.isOrchestrator);
  const mine = new Set(input.creatures.filter((c) => c.side === 0 && !c.isOrchestrator).map((c) => c.index));
  const out = new Map<number, Fired[]>();
  for (const e of input.events) {
    if (e.type === 'Damage' || e.type === 'Healed') hp.set(e.target, e.hpAfter);
    if (e.type !== 'CardTrace' || !mine.has(e.actor)) continue;
    const deck = input.deckOf(e.actor);
    const card = deck === null ? undefined : [...deck.cards, deck.default].find((k) => k.id === e.firedCardId);
    const youLow = you !== undefined && (hp.get(you.index) ?? 0) * 2 < (maxHp.get(you.index) ?? 0);
    out.set(e.actor, [...(out.get(e.actor) ?? []), { card, cardId: e.firedCardId, youLow }]);
  }
  return out;
}

function linesFor(name: string, fired: readonly Fired[], deck: Deck | null, input: KeptInput, faintedRound: number | null): string[] {
  const byMove = new Map<string, { n: number; low: number; isDefault: boolean }>();
  for (const f of fired) {
    const move = f.card === undefined ? f.cardId : input.moveName(f.card.move);
    const entry = byMove.get(move) ?? { n: 0, low: 0, isDefault: deck !== null && f.card === deck.default };
    byMove.set(move, { ...entry, n: entry.n + 1, low: entry.low + (f.youLow ? 1 : 0) });
  }
  const [top, ...rest] = [...byMove].sort((a, b) => b[1].n - a[1].n);
  if (top === undefined) return [];
  const [move, t] = top;
  const low = t.low > 0 ? `, ${t.low} of them while you were under half HP` : '';
  const lines = [`${name} kept using ${move}: ${t.n} of ${fired.length} turns${low}${t.isDefault ? ' (its Default)' : ''}.`];
  for (const [m, r] of rest) lines.push(`It also used ${m} ${times(r.n)}${r.isDefault ? ' (its Default)' : ''}.`);
  for (const taught of deck?.cards ?? []) {
    if (fired.some((f) => f.card === taught)) continue;
    lines.push(`Its card '${cardText(taught, input.moveName)}' never fired (${conditionFalseText(taught, input.moveName)}).`);
  }
  if (faintedRound !== null) lines.push(`It went offline in round ${faintedRound}.`);
  return lines;
}

/** What each of the player's deck-driven teammates kept doing all fight; empty when none acted from a deck. */
export function keptSummary(input: KeptInput): string[] {
  const fainted = new Map<number, number>();
  for (const e of input.events) if (e.type === 'Fainted' && !fainted.has(e.target)) fainted.set(e.target, e.round);
  return [...firedCards(input)].flatMap(([actor, fired]) => {
    const name = input.creatures.find((c) => c.index === actor)?.name ?? '???';
    return linesFor(name, fired, input.deckOf(actor), input, fainted.get(actor) ?? null);
  });
}

export interface GraftInput {
  readonly events: readonly BattleEvent[];
  readonly playerIndex: number;
  readonly graftMove: string;
  readonly moveName: MoveNamer;
}

/** The graft path's debrief: how often you used the grafted move, and what it is good for. */
export function graftSummary(input: GraftInput): string[] {
  const yours = input.events.filter((e): e is Extract<BattleEvent, { type: 'MoveUsed' }> => e.type === 'MoveUsed' && e.actor === input.playerIndex);
  const used = yours.filter((e) => e.moveId === input.graftMove).length;
  const move = input.moveName(input.graftMove);
  return [used === 0 ? `You never used ${move}.` : `You used ${move} ${times(used)} in ${yours.length} turns.`, GRAFT_HINT];
}
