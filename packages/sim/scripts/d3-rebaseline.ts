// Task D3 helper (first tuning pass): for one archetype, repeat `pnpm sim search` at the same seed (the search is
// deterministic, so this reproduces the report's deck and held-out scores), check the search's final deck against the
// archetype's headline cards, restore what the search broke, and print one JSON line with the base, final and
// restored decks' search, first held-out and second held-out scores. It writes no report and changes no file.
//
// It reproduces only from the pre-D3 archetype data (commit 77335b6): the search field is the other 19 archetypes'
// base decks, so once D3's decks are committed the same command finds different decks. Check out
// packages/sim/src/archetypes from 77335b6 first.
//
// Headline integrity (Ruling 149): a headline card the orchestrator's deck owns must keep its move and its condition
// category (parameters may change) and fire in at least half the battles it fired in before the search (the base deck's
// rate, 19 foes × 2 sides × 6 seeds). A card that fails is put back as the base deck had it (a dropped one in place of
// the non-headline card whose replacement cost the least on the search seeds). A headline card outside the Autopilot
// deck (a subagent's) that falls below its floor makes the deck unusable. Cards in PROTECTED are held to the same
// keep-move-and-category rule.
//
// Adoption (Ruling 150): a deck beats the base by at least 1 pp on the search's held-out label AND on a second one
// (`search-heldout2:<id>`, same field and k).
//
// Usage: pnpm --filter @latentia/sim exec tsx scripts/d3-rebaseline.ts <archetype id> <seed hex> [budget]

import type { Card, Deck, SeedHex } from '@latentia/engine';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { HEADLINES } from '../src/archetypes/headlines.js';
import { headlineRates } from '../src/headline-rates.js';
import { DEFAULT_K, evaluate, heldOut, searchDeck, searchLabel, withDeck } from '../src/search.js';
import { rate } from '../src/stats.js';
import type { Archetype } from '../src/types.js';

/** Non-headline cards that carry an archetype's idea. */
const PROTECTED: Record<string, readonly string[]> = { 'voice-pressure-parrot': ['glaze'] };

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
const headlines = HEADLINES[id] ?? [];
const owned = headlines.filter((h) => h.creature === orchLocal).map((h) => h.card);
const guarded = [...owned, ...(PROTECTED[id] ?? [])];
const baseIndex = (cardId: string): number => baseDeck.cards.findIndex((c) => c.id === cardId);
const pct = (x: number): number => Math.round(1000 * x) / 10;
const searchScore = (d: Deck): number => rate(evaluate(withDeck(base, d), field, k, searchLabel(id)));
const held1 = (d: Deck): number => rate(heldOut(withDeck(base, d), field, k));
const held2 = (d: Deck): number => rate(evaluate(withDeck(base, d), field, k, `search-heldout2:${id}`));
const baseRates = headlineRates(base, field);
const keyOf = (h: { creature: string; card: string }): string => `${h.creature}#${h.card}`;

type Check = { rates: Record<string, number>; fix: string[]; blocked: string[]; notes: string[] };
/** What is wrong with `d` as the deck of an archetype with these headline cards. */
function check(d: Deck): Check {
  const rates = headlineRates(withDeck(base, d), field);
  const fix: string[] = [];
  const blocked: string[] = [];
  const notes: string[] = [];
  for (const h of headlines) {
    const r = rates[keyOf(h)] ?? 0;
    const floor = 0.5 * (baseRates[keyOf(h)] ?? 0);
    const low = r < floor || r === 0;
    if (low) notes.push(`${keyOf(h)} fires in ${pct(r)}% of battles, floor ${pct(floor)}%`);
    if (h.creature === orchLocal) {
      if (low) fix.push(h.card);
    } else if (low) blocked.push(keyOf(h));
  }
  for (const c of guarded) {
    const b = baseDeck.cards.find((x) => x.id === c);
    const f = d.cards.find((x) => x.id === c);
    if (b === undefined) continue;
    if (f === undefined) {
      if (!fix.includes(c)) fix.push(c);
      notes.push(`${c} dropped`);
    } else if (f.move !== b.move || f.condition.category !== b.condition.category) {
      if (!fix.includes(c)) fix.push(c);
      notes.push(`${c} changed to ${f.move} / ${f.condition.category}`);
    }
  }
  return { rates, fix, blocked, notes };
}

function restore(d: Deck, cardIds: readonly string[]): Deck {
  let cards = d.cards.map((c) => c);
  for (const c of cardIds) {
    const orig = baseDeck.cards[baseIndex(c)] as Card;
    if (cards.some((x) => x.id === c)) {
      cards = cards.map((x) => (x.id === c ? orig : x));
      continue;
    }
    // Dropped: it takes the place of the non-guarded card whose replacement costs the least on the search seeds.
    let best: { cards: Card[]; score: number } | null = null;
    cards.forEach((x, j) => {
      if (guarded.includes(x.id)) return;
      const trial = cards.map((y, m) => (m === j ? orig : y));
      const s = searchScore({ ...d, cards: trial });
      if (best === null || s > best.score) best = { cards: trial, score: s };
    });
    if (best !== null) cards = (best as { cards: Card[] }).cards;
  }
  return { ...d, cards };
}

/** Tries the card at every priority position and keeps the best-scoring deck on which it clears its floor (else the one where it fires most). */
function reposition(d: Deck, cardId: string): Deck {
  const at = d.cards.findIndex((c) => c.id === cardId);
  if (at < 0) return d;
  const rest = d.cards.filter((_, j) => j !== at);
  const moved = d.cards[at] as Card;
  let best: { deck: Deck; ok: boolean; metric: number } | null = null;
  for (let j = 0; j < d.cards.length; j++) {
    const cards = [...rest.slice(0, j), moved, ...rest.slice(j)];
    const deck = { ...d, cards };
    const c = check(deck);
    const ok = !c.fix.includes(cardId);
    const h = headlines.find((x) => x.card === cardId && x.creature === orchLocal);
    const metric = ok ? searchScore(deck) + 10 : h === undefined ? 0 : (c.rates[keyOf(h)] ?? 0);
    if (best === null || metric > best.metric) best = { deck, ok, metric };
  }
  return (best as { deck: Deck }).deck;
}

const result = searchDeck(base, field, budget, seed as SeedHex, { k });
const final = result.deck;
const baseH1 = held1(baseDeck);
const baseH2 = held2(baseDeck);
const rawCheck = check(final);

const trail: string[] = [];
let candidate: Deck | null = final;
let cand = rawCheck;
for (let round = 0; round < 3 && candidate !== null && (cand.fix.length > 0 || cand.blocked.length > 0); round++) {
  if (cand.fix.length === 0) {
    candidate = null; // a subagent headline fell below its floor; the Autopilot deck cannot restore it
    break;
  }
  const failing = cand.fix;
  candidate = restore(candidate, round < 2 ? failing : guarded);
  cand = check(candidate);
  if (cand.fix.length > 0 && round >= 1) {
    for (const c of cand.fix) candidate = reposition(candidate, c);
    cand = check(candidate);
  }
  trail.push(`round ${round + 1}: ${cand.notes.join('; ') || 'ok'}`);
}
if (candidate !== null && (cand.fix.length > 0 || cand.blocked.length > 0)) candidate = null;

console.log(
  JSON.stringify({
    id,
    seed,
    budget,
    searchBase: pct(result.history[0] as number),
    searchFinal: pct(result.winRate),
    heldBase: pct(baseH1),
    heldBase2: pct(baseH2),
    heldFinal: pct(held1(final)),
    heldFinal2: pct(held2(final)),
    finalDeck: final,
    rawNotes: rawCheck.notes,
    trail,
    rawBlocked: rawCheck.blocked,
    baseRates,
    finalRates: rawCheck.rates,
    candidate:
      candidate === null
        ? null
        : {
            deck: candidate,
            changed: JSON.stringify(candidate) !== JSON.stringify(baseDeck),
            restored: JSON.stringify(candidate) !== JSON.stringify(final),
            search: pct(searchScore(candidate)),
            held: pct(held1(candidate)),
            held2: pct(held2(candidate)),
            rates: cand.rates,
          },
  }),
);
