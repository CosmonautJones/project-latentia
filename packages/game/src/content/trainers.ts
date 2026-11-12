// The v0 decks (plan "Content": trainer decks live here). Every deck is plain engine data, read top to bottom; the
// Default card fires when nothing above it does. Card ids double as the "why?" popup's card names, so they are
// short words. Each deck is checked by validateSetup through the battle setups' unit test.

import type { Card, Condition, Deck, TargetSelector, Temperature } from '@latentia/engine';
import type { StarterId } from '../flow/flow.js';

const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
const FULL: Condition = { category: 'contextFill', op: 'atLeast', pct: 75 };
const FOE_HURT: Condition = { category: 'hp', op: 'below', pct: 50 };
const FOE_HEALTHY: Condition = { category: 'hp', op: 'atLeast', pct: 50 };
const FOE_BUFFED: Condition = { category: 'foeBuffed' };
const FOE_TOKEN_BURST: Condition = { category: 'foeLastMove', move: 'token-burst' };
const SELF_HEALTHY: Condition = { category: 'hp', op: 'atLeast', pct: 50 };
const COIN: Condition = { category: 'coin' };

const card = (id: string, subject: Card['subject'], condition: Condition, move: string, target: TargetSelector): Card => ({ id, subject, condition, move, target });
const deck = (fallback: Card, ...cards: Card[]): Deck => ({ cards, default: fallback });

/** Compact once the window is three-quarters full, so a deck never drowns in its own tokens. */
const tidy = (): Card => card('tidy', 'self', FULL, 'compact', 'self');

/**
 * Kip's Autopilot. His starter counters yours at the same level, and at L5 a on-distribution (2×) hit takes most of a bar,
 * so a Kip who attacked every round would be unbeatable. He is too busy tidying his context window for the
 * screenshot: on heads he jabs with his weakest attack, on tails he Compacts. The intent preview shows which, and
 * the "why?" popup shows the coin. (Simulated naive play wins about 40-80% depending on the starter.)
 */
const kip = (jab: string): Deck => deck(card('default', 'self', ALWAYS, 'compact', 'self'), card('jab', 'self', COIN, jab, 'lowestHpFoe'));

const KIP_DECKS: Readonly<Record<StarterId, Deck>> = {
  blitzr: kip('token-burst'),
  sagelet: kip('chain-of-thought'),
  forkling: kip('swarm-of-fine-tunes'),
};

export const kipDeck = (kipStarter: StarterId): Deck => KIP_DECKS[kipStarter];

/** The wild Tokenibble: nibbles while you're healthy, bursts when you're not. */
export const WILD_TOKENIBBLE_DECK: Deck = deck(
  card('default', 'self', ALWAYS, 'token-burst', 'lowestHpFoe'),
  tidy(),
  card('nibble', 'foe', FOE_HEALTHY, 'token-nibble', 'lowestHpFoe'),
);

/** A trainer's knobs: its orchestrator's level (by the player's starter), its Autopilot deck and its temperature. */
export interface TrainerTuning {
  readonly level: Readonly<Record<StarterId, number>>;
  readonly deck: Deck;
  readonly temperature: Temperature;
}

/**
 * Bootcamp Grad (plan step 8, the core-loop test: lose → teach → rematch). He plays exactly by the tutorial (T0) and
 * always goes for the most senior model in the room (your orchestrator). Two cards make him react to what your
 * subagent does: he answers any buff with Accept All ("you optimised? I accept everything!"), and he answers a
 * Token Burst with Accept All too ("week 3 covered that one"). Otherwise he Merge Conflicts. So a Tokenibble taught to
 * stretch (Low Latency) or to open with Token Burst draws his biggest hit, and one taught Early Exit does not.
 *
 * Measured on engine 0.4.1 (unchanged on 0.4.2, which only adds a read-only helper) by `pnpm --filter @latentia/game measure-loop` (scripts/measure-loop.ts): a naive player
 * (its strongest affordable damaging move, T2) over trainer seeds 0-199 for each starter, so 600 fights a row. Win %
 * pooled (sagelet / blitzr / forkling):
 *
 *   chosen (L7/L7/L6, T0)   bad 12.8% (38/0/1)   situational 82.5% (100/48/100)   good 99.3% (100/98/100)   graft 69.8% (92/30/88)
 *     so the bad card loses 87.2%, the good card wins 99.3%, situational sits between, and graft wins 69.8%.
 *   Counterfactuals (one knob changed; the script prints them all):
 *   - T1: bad 21.2, situational 85.2, good 92.0, graft 63.3. T2: bad 27.8, situational 86.0, good 92.3 (only 6 points
 *     above situational), graft 68.2. T0 keeps the clearest gap between the three cards.
 *   - Forkling at L7 like the others: graft 42.8 (Forkling 7%); a gridded Forkling's 7-cell window can't keep up.
 *   - Blitzr at L6: situational 99.5 = good 100.0, so the card choice barely matters. All at L6: the same, and
 *     Sagelet's bad card wins 99%.
 *   - Without the Token Burst answer: situational 99.5 = good 99.3. Without the buff answer: bad 79.7, no loss.
 *   - Aiming at the lowest-HP foe (Tokenibble) instead: everything wins 100%; Tokenibble just soaks the hits.
 *   - P2's Grad (L6, T2, hype then Accept All / Segfault at the lowest-HP foe): bad 97.0, good 99.7.
 *
 * The level depends on the starter, the way Kip's pick does. The weak spot is Blitzr on the graft path (30%): its
 * best hit, Distilled Strike, is neutral on Code and Blitzr is frail. The graft loss hint (journey-text.ts GRAFT_HINTS)
 * is measured too: following it takes the graft path from 91.5/30.0/88.0% to 99.0/51.5/93.0% (Token Nibble when 4 or
 * fewer cells are free for Sagelet and Forkling; T0 for Blitzr, whose hits all cost 1 like Token Nibble).
 */
export const BOOTCAMP_GRAD: TrainerTuning = {
  level: { sagelet: 7, blitzr: 7, forkling: 6 },
  temperature: 0,
  deck: deck(
    card('default', 'self', ALWAYS, 'merge-conflict', 'highestAtkFoe'),
    tidy(),
    card('outdo', 'foe', FOE_BUFFED, 'accept-all', 'highestAtkFoe'),
    card('week3', 'foe', FOE_TOKEN_BURST, 'accept-all', 'highestAtkFoe'),
  ),
};

/**
 * The three example cards the card tutorial offers a spun-up Tokenibble (ruling V3: it keeps only its three
 * non-signature moves, Token Burst, Early Exit and Low Latency). Each is the one active card above its Default (Token
 * Burst at the weakest foe), and they are a real choice for P4's lose → teach → rematch loop. Measured with the player
 * only Compacting (test/unit/battles.test.ts): `good` deals the most, `situational` less, `bad` next to nothing.
 */
export interface CardPreset {
  readonly id: string;
  readonly card: Card;
  readonly verdict: 'good' | 'situational' | 'bad';
  /** One line on what the card is for, shown under it in the card tutorial and the debrief swap. */
  readonly hint: string;
}

export const TOKENIBBLE_PRESETS: readonly CardPreset[] = [
  // Finisher: Early Exit's +3 priority only once the foe is under half HP; Token Burst until then.
  { id: 'tutorial.a', verdict: 'situational', hint: 'A finisher: saves its best hit for a hurt foe.', card: card('tutorial.a', 'foe', FOE_HURT, 'early-exit', 'lowestHpFoe') },
  // Early Exit every round: a stronger hit that always goes first.
  { id: 'tutorial.b', verdict: 'good', hint: 'Simple: its strongest hit, first, every turn.', card: card('tutorial.b', 'self', ALWAYS, 'early-exit', 'lowestHpFoe') },
  // Speed buffs while healthy: Tokenibble keeps stretching instead of fighting.
  { id: 'tutorial.c', verdict: 'bad', hint: 'Warms up while healthy: faster and faster.', card: card('tutorial.c', 'self', SELF_HEALTHY, 'low-latency', 'self') },
];

export const TOKENIBBLE_DEFAULT_CARD: Card = card('default', 'self', ALWAYS, 'token-burst', 'lowestHpFoe');

/** Tokenibble's subagent deck: the taught card (preset a when none was taught) above Token Burst. */
export function tokenibbleDeck(presetId: string | null): Deck {
  const preset = TOKENIBBLE_PRESETS.find((p) => p.id === presetId) ?? TOKENIBBLE_PRESETS[0];
  if (!preset) throw new Error('no Tokenibble presets');
  return deck(TOKENIBBLE_DEFAULT_CARD, preset.card);
}
