import { MOVES, orchestratorMoves, validateSetup, type Deck, type TargetSelector } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.js';
import { card, cooldown, OPENER, WEAK } from '../src/archetypes/build.js';
import { cardText, deckTable } from '../src/card-text.js';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { SEARCH, searchCommand } from '../src/commands/search.js';
import { drawCandidate, movePool, mutate, mutationPools, MUTATIONS, randomCondition, TURN_MAX_ROUND } from '../src/mutations.js';
import { ACCEPT_MARGIN, DEFAULT_K, evaluate, heldOut, searchDeck, withDeck } from '../src/search.js';
import { Sfc32 } from '../src/sfc32.js';
import type { Archetype } from '../src/types.js';
import { PROVENANCE_COLUMNS } from '../src/report.js';
import { csvRows, readOut, testContext } from './helpers/context.js';

// Task C4 (Rulings 139 and 141): a budgeted hill-climbing search over an archetype's 8-card Autopilot deck.

const byId = (id: string): Archetype => ARCHETYPES.find((a) => a.id === id) as Archetype;
const BASE = byId('speed-rush-blitzr');
/** A tiny field for fast tests (two foes the base often loses to, so there is room to climb): one evaluation at k = 1 is 2 × 2 × 1 = 4 battles. */
const FIELD = [byId('open-swarm-forkling'), byId('voice-pressure-parrot')].filter((a) => a !== undefined);
const SEED = '0123456789abcdef0123456789abcdef';
const deckOf = (a: Archetype): Deck => a.side.autopilot?.deck as Deck;
/** Float slack for comparing rates (the search itself compares integer-and-half points). */
const EPS = 1e-9;

describe('searchDeck', () => {
  it('uses the tiny field it is given', () => {
    expect(FIELD).toHaveLength(2);
  });

  it('never exceeds its budget, counting the base deck’s evaluation', () => {
    for (const budget of [4, 7, 13, 30]) {
      const r = searchDeck(BASE, FIELD, budget, SEED, { k: 1 });
      expect(r.battlesUsed, `budget ${budget}`).toBeLessThanOrEqual(budget);
      // Each evaluation is 2 foes × 2 sides × k battles; the search runs as many whole evaluations as fit.
      expect(r.battlesUsed).toBe(Math.floor(budget / 4) * 4);
      expect(r.evaluations * r.battlesPerEvaluation).toBe(r.battlesUsed);
      expect(r.trials).toHaveLength(r.evaluations);
    }
  });

  it('rejects a budget below one evaluation, and a field holding the base archetype', () => {
    expect(() => searchDeck(BASE, FIELD, 3, SEED, { k: 1 })).toThrow(RangeError);
    expect(() => searchDeck(BASE, [...FIELD, BASE], 100, SEED, { k: 1 })).toThrow(RangeError);
  });

  it('is deterministic for a seed: the same deck, history and battlesUsed', () => {
    const a = searchDeck(BASE, FIELD, 40, SEED, { k: 1 });
    const b = searchDeck(BASE, FIELD, 40, SEED, { k: 1 });
    expect(b.deck).toEqual(a.deck);
    expect(b.history).toEqual(a.history);
    expect(b.battlesUsed).toBe(a.battlesUsed);
    expect(b.trials).toEqual(a.trials);
    // Another seed draws other mutations (the base evaluation is the same: common random numbers).
    const c = searchDeck(BASE, FIELD, 40, 'fedcba9876543210fedcba9876543210', { k: 1 });
    expect(c.trials.map((t) => t.mutation)).not.toEqual(a.trials.map((t) => t.mutation));
    expect(c.history[0]).toBe(a.history[0]);
  });

  it('records accepted-step win rates that each beat the previous one by at least the 1 pp margin (Ruling 141)', () => {
    expect(ACCEPT_MARGIN).toBe(0.01);
    const r = searchDeck(BASE, FIELD, 120, SEED, { k: 1 });
    for (let i = 1; i < r.history.length; i++) expect(r.history[i]).toBeGreaterThanOrEqual((r.history[i - 1] as number) + ACCEPT_MARGIN - EPS);
    expect(r.history[0]).toBe(evaluate(BASE, FIELD, 1, 'search:speed-rush-blitzr').points / r.battlesPerEvaluation);
    expect(r.history.at(-1)).toBe(r.winRate);
    // The base deck is trial 0 (kept by definition); every other kept trial is one accepted step.
    expect(r.history).toHaveLength(r.trials.filter((t) => t.accepted).length);
    // Every trial is scored on the same seeds as the deck it was measured against, and accepted only when at least the margin higher.
    let best = r.history[0] as number;
    for (const t of r.trials.slice(1)) {
      expect(t.accepted).toBe(t.score >= best + ACCEPT_MARGIN - EPS);
      if (t.accepted) best = t.score;
    }
    // The final deck's score, re-measured, is its reported win rate.
    expect(evaluate(withDeck(BASE, r.deck), FIELD, 1, 'search:speed-rush-blitzr').points / r.battlesPerEvaluation).toBe(r.winRate);
  });

  it('applies the margin where a score step is finer than 1 pp (k = 13: 52 battles per evaluation)', () => {
    const r = searchDeck(BASE, FIELD, 52 * 8, SEED, { k: 13 });
    expect(r.battlesPerEvaluation).toBe(52);
    for (let i = 1; i < r.history.length; i++) expect(r.history[i]).toBeGreaterThanOrEqual((r.history[i - 1] as number) + ACCEPT_MARGIN - EPS);
    let best = r.history[0] as number;
    for (const t of r.trials.slice(1)) {
      expect(t.accepted, t.mutation).toBe(t.score >= best + ACCEPT_MARGIN - EPS);
      if (t.accepted) best = t.score;
    }
  });

  it('keeps exactly 8 cards plus the base Default, passes validateSetup, and never mutates ARCHETYPES', () => {
    const before = structuredClone(ARCHETYPES);
    const r = searchDeck(BASE, FIELD, 120, SEED, { k: 1 });
    expect(ARCHETYPES).toEqual(before);
    expect(r.deck.cards).toHaveLength(8);
    expect(r.deck.default).toEqual(deckOf(BASE).default);
    const side = withDeck(BASE, r.deck).side;
    for (const foe of FIELD) expect(validateSetup({ a: { ...side, opponentId: foe.id }, b: { ...foe.side, opponentId: BASE.id }, kind: 'trainer' }).errors).toEqual([]);
    // A search this long accepts at least one step from this base (a regression guard, not a balance claim).
    expect(r.history.length).toBeGreaterThan(1);
  });
});

describe('mutations', () => {
  const pool = movePool(BASE.side);
  const pools = mutationPools(BASE, FIELD);

  it('draws moves from the orchestrator’s known moves: its signature, its grid Skills and grafts, and the universals, in that order', () => {
    // The order is part of the search stream (C4 m1: it must not change when movePool reads the engine's rule).
    expect(pool).toEqual(['ship-it', 'token-burst', 'distilled-strike', 'compact', 'clear', 'guardrail']);
  });

  it('takes the orchestrator’s moves from the engine’s own orchestratorMoves (C4 m1), then the universals', () => {
    const universal = Object.values(MOVES).filter((m) => m.universal === true).map((m) => m.id);
    for (const a of ARCHETYPES) expect(movePool(a.side), a.id).toEqual([...new Set([...orchestratorMoves(a.side), ...universal])]);
  });

  it('applies each of the four mutations as a single change to a new 8-card deck', () => {
    const base = deckOf(BASE);
    const seen = new Set<string>();
    const rng = new Sfc32(SEED);
    for (let i = 0; i < 400; i++) {
      const m = mutate(base, pools, rng, `n${i}`);
      if (m === null) continue;
      seen.add(m.kind);
      expect(m.deck.cards).toHaveLength(8);
      expect(m.deck.default).toBe(base.default);
      expect(m.deck).not.toBe(base);
      const changed = m.deck.cards.map((c, j) => JSON.stringify(c) !== JSON.stringify(base.cards[j])).filter(Boolean).length;
      if (m.kind === 'reorder') {
        expect([...m.deck.cards].map((c) => c.id).sort()).toEqual(base.cards.map((c) => c.id).sort());
        expect(changed).toBeGreaterThanOrEqual(2);
      } else {
        expect(changed).toBe(1);
        const old = base.cards[m.index]!;
        const neu = m.deck.cards[m.index]!;
        // A move change keeps the card's target unless it is on the wrong side for the new move (Ruling 141).
        if (m.kind === 'move') expect({ ...neu, move: old.move, target: old.target }).toEqual(old);
        if (m.kind === 'condition') expect({ ...neu, subject: old.subject, condition: old.condition }).toEqual(old);
        if (m.kind === 'replace') expect(neu.id).toBe(`n${i}`);
        expect(pool).toContain(neu.move);
      }
    }
    expect([...seen].sort()).toEqual([...MUTATIONS].sort());
    // The base deck (deep-frozen) is untouched.
    expect(Object.isFrozen(base.cards[0])).toBe(true);
  });

  it('redraws an invalid candidate at no cost, and gives up after its redraw cap instead of looping', () => {
    const base = deckOf(BASE);
    let calls = 0;
    const never = (): boolean => {
      calls++;
      return false;
    };
    expect(drawCandidate(base, pools, new Sfc32(SEED), 'n', never, 25)).toBeNull();
    expect(calls).toBeLessThanOrEqual(26);
    expect(calls).toBeGreaterThan(0);
    const ok = drawCandidate(base, pools, new Sfc32(SEED), 'n', () => true, 25);
    expect(ok?.deck.cards).toHaveLength(8);
  });
});

describe('mutation draws (Ruling 141)', () => {
  /** Where a selector aims, written out independently of the code under test. */
  const ALLY_SELECTORS: readonly TargetSelector[] = ['self', 'orchestrator', 'lowestHpAlly'];
  /** An attack: a move aimed at a foe (foe kinds and `other`); self, none and ally moves are self, buff and heal moves. */
  const isAttack = (move: string): boolean => !['self', 'none', 'ally'].includes(MOVES[move as keyof typeof MOVES].target);

  it('never pairs an attack with a self or ally selector, or a self, buff or heal move with a foe selector', () => {
    let replaced = 0;
    let moved = 0;
    for (const base of ARCHETYPES) {
      const field = ARCHETYPES.filter((a) => a !== base);
      const pools = mutationPools(base, field);
      const rng = new Sfc32(SEED);
      for (let i = 0; i < 200; i++) {
        const m = mutate(deckOf(base), pools, rng, `n${i}`);
        if (m === null || (m.kind !== 'replace' && m.kind !== 'move')) continue;
        const c = m.deck.cards[m.index]!;
        if (m.kind === 'replace') replaced++;
        else moved++;
        expect(ALLY_SELECTORS.includes(c.target), `${base.id} ${m.label} → ${c.target}`).toBe(!isAttack(c.move));
      }
    }
    expect(replaced).toBeGreaterThan(100);
    expect(moved).toBeGreaterThan(100);
  });

  it('draws foeLastMove moves from every field creature (orchestrators and subagents), and turn rounds a fight can reach (never below 1)', () => {
    const pools = mutationPools(BASE, FIELD);
    const subagentMoves = FIELD.flatMap((f) => [...f.side.active, ...f.side.bench].flatMap((c) => c.moves));
    const fieldMoves = new Set([...FIELD.flatMap((f) => movePool(f.side)), ...subagentMoves]);
    expect(new Set(pools.foeMoves)).toEqual(fieldMoves);
    expect(subagentMoves.some((m) => !FIELD.some((f) => movePool(f.side).includes(m)))).toBe(true);
    const rng = new Sfc32(SEED);
    const lastMoves = new Set<string>();
    const rounds = { below: new Set<number>(), atLeast: new Set<number>() };
    for (let i = 0; i < 5000; i++) {
      const c = randomCondition(rng, pools.foeMoves);
      if (c.category === 'foeLastMove') lastMoves.add(c.move);
      if (c.category === 'turn') rounds[c.op].add(c.round);
    }
    for (const m of lastMoves) expect(fieldMoves.has(m), m).toBe(true);
    expect(lastMoves.size).toBeGreaterThan(1);
    expect(Math.min(...rounds.below)).toBe(2);
    expect(Math.min(...rounds.atLeast)).toBe(1);
    expect(Math.max(...rounds.below, ...rounds.atLeast)).toBe(TURN_MAX_ROUND);
    expect(TURN_MAX_ROUND).toBeLessThanOrEqual(12);
  });
});

describe('Sfc32', () => {
  it('is deterministic for a seed, and rejects a seed that is not 32 lowercase hex or is all zero', () => {
    const a = new Sfc32(SEED);
    const b = new Sfc32(SEED);
    const xs = Array.from({ length: 10 }, () => a.below(1000));
    expect(Array.from({ length: 10 }, () => b.below(1000))).toEqual(xs);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0);
    for (const x of xs) expect(x).toBeLessThan(1000);
    for (const bad of ['0'.repeat(32), SEED.toUpperCase(), SEED.slice(1), `${SEED}0`]) expect(() => new Sfc32(bad)).toThrow(RangeError);
  });
});

describe('heldOut', () => {
  it('scores a deck on seeds the search never saw', () => {
    const search = evaluate(BASE, FIELD, 3, 'search:speed-rush-blitzr');
    const fresh = heldOut(BASE, FIELD, 3);
    expect(fresh.n).toBe(search.n);
    expect(heldOut(BASE, FIELD, 3)).toEqual(fresh);
  });
});

describe('card text', () => {
  it('prints a card as IF <subject> <condition> THEN <move> → <target>, and Default as OTHERWISE', () => {
    expect(cardText(card('finish', 'foe', WEAK, 'token-burst', 'lowestHpFoe'))).toBe('IF foe hp < 25% THEN token-burst → lowestHpFoe');
    expect(cardText(card('o', 'self', OPENER, 'ship-it', 'randomFoe', { allowOverflow: true }))).toBe('IF self round < 2 THEN ship-it → randomFoe (allowOverflow)');
    expect(cardText(card('c', 'self', cooldown(3), 'compact', 'self'))).toBe('IF self has not used the move for 3 rounds THEN compact → self');
    const rows = deckTable(deckOf(BASE)).rows;
    expect(rows).toHaveLength(9);
    expect(rows.at(-1)).toEqual(['default', 'ship', 'OTHERWISE ship-it → lowestHpFoe']);
  });
});

describe('search command', () => {
  it('writes the history, the final deck as cards, the held-out comparison and battlesUsed', async () => {
    const ctx = testContext();
    expect(await searchCommand(['--archetype', BASE.id, '--budget', '120', '--seed', SEED, '--tag', 'scratch'], ctx, { k: 1 })).toBe(0);
    const md = readOut(ctx, 'search-2026-01-02-scratch.md');
    const r = searchDeck(BASE, ARCHETYPES.filter((a) => a.id !== BASE.id), 120, SEED, { k: 1 });
    expect(md).toContain('## Score history');
    expect(md).toContain('## Final deck');
    expect(md).toContain('## Held-out check');
    expect(md).toContain(`- battlesUsed: ${r.battlesUsed} of 120 (unused: ${120 - r.battlesUsed})`);
    expect(md).toContain('- acceptance margin: 1.0 pp on the search seeds');
    expect(md).toContain('- k: 1 seed per foe per side (19 foes × 2 sides × 1 = 38 battles per evaluation)');
    expect(md).toContain(`- seed: ${SEED}`);
    for (const c of r.deck.cards) expect(md).toContain(`| ${c.id} |`);
    expect(md).toMatch(/\| default \|/);
    expect(md).toMatch(/IF (self|orchestrator|foe) /);
    const rows = csvRows(readOut(ctx, 'search-2026-01-02-scratch.csv'));
    expect(rows[0]).toEqual(['evaluation', 'mutation', 'score', 'accepted', 'best', 'battles_used', ...PROVENANCE_COLUMNS]);
    expect(rows).toHaveLength(1 + r.evaluations);
    expect(rows.at(-1)?.[5]).toBe(String(r.battlesUsed));
    expect(rows.filter((x) => x[3] === 'yes').map((x) => Number(x[2]))).toEqual(r.history);
  });

  it('defaults k so a 20,000 budget gives 25–50 evaluations against the 19-archetype field', () => {
    const perEval = 19 * 2 * DEFAULT_K;
    expect(Math.floor(20_000 / perEval)).toBeGreaterThanOrEqual(25);
    expect(Math.floor(20_000 / perEval)).toBeLessThanOrEqual(50);
  });

  it('rejects bad flags with a UsageError before running anything', async () => {
    const ctx = testContext();
    const run = (args: string[]) => searchCommand(args, ctx, { k: 1 });
    await expect(run(['--archetype', BASE.id, '--budget', '100', '--seeds', '5'])).rejects.toThrow(/unknown flag --seeds/);
    await expect(run(['--archetype', BASE.id])).rejects.toThrow(/missing --budget/);
    await expect(run(['--budget', '100'])).rejects.toThrow(/missing --archetype/);
    await expect(run(['--archetype', 'nope', '--budget', '100'])).rejects.toThrow(/unknown archetype nope/);
    await expect(run(['--archetype', BASE.id, '--budget', '37'])).rejects.toThrow(/below one evaluation/);
    await expect(run(['--archetype', BASE.id, '--budget', '100', 'extra'])).rejects.toThrow(/unexpected argument extra/);
    for (const s of ['0'.repeat(32), SEED.toUpperCase(), SEED.slice(1)]) await expect(run(['--archetype', BASE.id, '--budget', '100', '--seed', s])).rejects.toThrow(UsageError);
    expect(SEARCH.name).toBe('search');
  });
});
