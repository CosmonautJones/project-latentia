// Task D3 helper (first tuning pass): for one archetype, repeat `pnpm sim search` at the same seed (the search is
// deterministic, so this reproduces the report's deck and held-out scores), check the final deck against the
// archetype's headline cards (kept = still in the deck, same move, still firing; a changed condition is allowed), try to restore any the search dropped or altered, and print one JSON line with every
// candidate's search and held-out score. It writes no report and changes no file.
//
// Usage: pnpm --filter @latentia/sim exec tsx scripts/d3-rebaseline.ts <archetype id> <seed hex> [budget]

import { simulate, type Card, type Deck, type SeedHex } from '@latentia/engine';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { cardFires, HEADLINES } from '../src/archetypes/headlines.js';
import { seedFor } from '../src/runner.js';
import { DEFAULT_K, evaluate, heldOut, searchDeck, searchLabel, withDeck } from '../src/search.js';
import { rate } from '../src/stats.js';
import type { Archetype } from '../src/types.js';

const [id, seed, budgetArg] = process.argv.slice(2);
if (id === undefined || seed === undefined) throw new Error('usage: d3-rebaseline.ts <archetype id> <seed hex> [budget]');
const found = ARCHETYPES.find((a) => a.id === id);
if (found === undefined) throw new Error(`unknown archetype ${id}`);
const base: Archetype = found;
const budget = budgetArg === undefined ? 20000 : Number(budgetArg);
const field = ARCHETYPES.filter((a) => a.id !== id);
const k = DEFAULT_K;
const baseDeck = base.side.autopilot?.deck as Deck;
const orchLocal = base.side.orchestrator.id.slice(id.length + 1);
const owned = (HEADLINES[id] ?? []).filter((h) => h.creature === orchLocal).map((h) => h.card);
const baseIndex = (cardId: string): number => baseDeck.cards.findIndex((c) => c.id === cardId);

const pct = (x: number): number => Math.round(1000 * x) / 10;
const searchScore = (d: Deck): number => rate(evaluate(withDeck(base, d), field, k, searchLabel(id)));
const heldScore = (d: Deck): number => rate(heldOut(withDeck(base, d), field, k));

/** Fire counts of the orchestrator-owned headline cards over 19 foes × 2 sides × 4 seeds. */
function fires(d: Deck): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(owned.map((c) => [c, 0]));
  const me = withDeck(base, d);
  for (const foe of field) {
    for (let i = 0; i < 4; i++) {
      for (const flip of [false, true]) {
        const a = flip ? foe : me;
        const b = flip ? me : foe;
        const r = simulate({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' }, seedFor(`d3fire:${foe.id}`, i), { kind: 'autopilot' });
        const mine = cardFires(r).get(base.side.orchestrator.id);
        for (const c of owned) out[c] = (out[c] ?? 0) + (mine?.get(c) ?? 0);
      }
    }
  }
  return out;
}

const result = searchDeck(base, field, budget, seed as SeedHex, { k });
const final = result.deck;
const baseHeld = heldScore(baseDeck);
const finalHeld = heldScore(final);

const dropped = owned.filter((c) => !final.cards.some((x) => x.id === c));
const altered = owned.filter((c) => {
  const f = final.cards.find((x) => x.id === c);
  const b = baseDeck.cards.find((x) => x.id === c);
  return f !== undefined && b !== undefined && f.move !== b.move;
});
const finalFires = fires(final);
const silent = owned.filter((c) => (finalFires[c] ?? 0) === 0);
const headlineKept = dropped.length === 0 && altered.length === 0 && silent.length === 0;

type Candidate = { label: string; deck: Deck; search: number; held: number; fires: Record<string, number> };
let restored: Candidate | null = null;
if (!headlineKept && result.deck !== baseDeck) {
  let cards = final.cards.map((c) => c);
  // A headline card whose move the search changed, or which no longer fires, goes back to its base version in place.
  for (const c of new Set([...altered, ...silent.filter((s) => !dropped.includes(s))])) {
    const orig = baseDeck.cards[baseIndex(c)] as Card;
    cards = cards.map((x) => (x.id === c ? orig : x));
  }
  const protectedIds = new Set(owned);
  for (const c of dropped) {
    const orig = baseDeck.cards[baseIndex(c)] as Card;
    // The weakest non-headline card is the one whose replacement by the headline card costs the least on the search seeds.
    let best: { cards: Card[]; score: number } | null = null;
    cards.forEach((x, j) => {
      if (protectedIds.has(x.id)) return;
      const trial = cards.map((y, m) => (m === j ? orig : y));
      const s = searchScore({ ...final, cards: trial });
      if (best === null || s > best.score) best = { cards: trial, score: s };
    });
    if (best !== null) cards = (best as { cards: Card[] }).cards;
  }
  let deck: Deck = { ...final, cards };
  let f = fires(deck);
  for (const c of owned) {
    if ((f[c] ?? 0) > 0) continue;
    // Silent headline card: move it back to its base position.
    const from = deck.cards.findIndex((x) => x.id === c);
    if (from < 0) continue;
    const to = Math.min(baseIndex(c), deck.cards.length - 1);
    const moved = deck.cards.filter((_, j) => j !== from);
    moved.splice(to, 0, deck.cards[from] as Card);
    deck = { ...deck, cards: moved };
    f = fires(deck);
  }
  restored = { label: 'final with headline cards restored', deck, search: searchScore(deck), held: heldScore(deck), fires: f };
}

console.log(
  JSON.stringify({
    id,
    seed,
    budget,
    searchBase: pct(result.history[0] as number),
    searchFinal: pct(result.winRate),
    heldBase: pct(rate(heldOut(base, field, k))),
    heldFinal: pct(finalHeld),
    owned,
    dropped,
    altered,
    silent,
    headlineKept,
    baseHeldDup: pct(baseHeld),
    finalDeck: final,
    restored: restored === null ? null : { ...restored, search: pct(restored.search), held: pct(restored.held) },
  }),
);
