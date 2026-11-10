// The v0 decks (plan "Content": trainer decks live here). Every deck is plain engine data, read top to bottom; the
// Default card fires when nothing above it does. Card ids double as the "why?" popup's card names, so they are
// short words. Each deck is checked by validateSetup through the battle setups' unit test.

import type { Card, Condition, Deck, TargetSelector } from '@latentia/engine';
import type { StarterId } from '../flow/flow.js';

const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
const OPENER: Condition = { category: 'turn', op: 'below', round: 2 };
const FULL: Condition = { category: 'contextFill', op: 'atLeast', pct: 75 };
const FOE_HURT: Condition = { category: 'hp', op: 'below', pct: 50 };
const FOE_HEALTHY: Condition = { category: 'hp', op: 'atLeast', pct: 50 };
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

/** The Bootcamp Grad's Vibrat: hypes itself up once, then Accept All on everything, then Segfault when it's tidy. */
export const BOOTCAMP_GRAD_DECK: Deck = deck(
  card('default', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
  tidy(),
  card('hype', 'self', OPENER, 'hype-train', 'self'),
  card('acceptall', 'foe', FOE_HEALTHY, 'accept-all', 'lowestHpFoe'),
  card('segfault', 'foe', FOE_HURT, 'segfault', 'lowestHpFoe'),
);

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
}

export const TOKENIBBLE_PRESETS: readonly CardPreset[] = [
  // Finisher: Early Exit's +3 priority only once the foe is under half HP; Token Burst until then.
  { id: 'tutorial.a', verdict: 'situational', card: card('tutorial.a', 'foe', FOE_HURT, 'early-exit', 'lowestHpFoe') },
  // Early Exit every round: a stronger hit that always goes first.
  { id: 'tutorial.b', verdict: 'good', card: card('tutorial.b', 'self', ALWAYS, 'early-exit', 'lowestHpFoe') },
  // Speed buffs while healthy: Tokenibble keeps stretching instead of fighting.
  { id: 'tutorial.c', verdict: 'bad', card: card('tutorial.c', 'self', SELF_HEALTHY, 'low-latency', 'self') },
];

export const TOKENIBBLE_DEFAULT_CARD: Card = card('default', 'self', ALWAYS, 'token-burst', 'lowestHpFoe');

/** Tokenibble's subagent deck: the taught card (preset a when none was taught) above Token Burst. */
export function tokenibbleDeck(presetId: string | null): Deck {
  const preset = TOKENIBBLE_PRESETS.find((p) => p.id === presetId) ?? TOKENIBBLE_PRESETS[0];
  if (!preset) throw new Error('no Tokenibble presets');
  return deck(TOKENIBBLE_DEFAULT_CARD, preset.card);
}
