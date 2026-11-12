import { describe, expect, it } from 'vitest';
import * as api from '../../src/index.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { BattleState, Temperature } from '../../src/battle/state.js';
import type { Card, Deck } from '../../src/cards/model.js';
import type { BattleEvent } from '../../src/events/types.js';
import { createBattle, getIntents, previewDamage, submitRound } from '../../src/index.js';
import { mon } from './helpers.js';

// previewDamage (0.4.2): the damage range of an intent's move, read before the round. It is checked against what the
// engine actually rolls: 300 seeds of the same opening, every non-crit hit inside [min, max] and both ends reached.

const ALWAYS = { category: 'turn', op: 'atLeast', round: 1 } as const;
const always = (move: string, target: Card['target'] = 'lowestHpFoe'): Deck => ({ cards: [], default: { id: 'default', subject: 'self', condition: ALWAYS, move, target } });
const solo = (tag: string, orchestrator: CreatureSetup, over: Partial<SideSetup> = {}): SideSetup => ({ orchestrator, active: [], bench: [], grid: null, opponentId: tag === 'a' ? 'b' : 'a', ...over });

/** The player Compacts (priority −2, so it acts last and changes nothing the foe's hit reads); the foe runs `deck`. */
function duel(foe: CreatureSetup, deck: Deck, temperature: Temperature = 2, me: CreatureSetup = mon('a-orch', 'sagelet')): BattleSetup {
  return { kind: 'wild', a: solo('a', me), b: solo('b', foe, { autopilot: { deck, temperature } }) };
}

const seed = (i: number): string => api.fnv1a64Hex(new TextEncoder().encode(`preview.${i}`)) + api.fnv1a64Hex(new TextEncoder().encode(`preview.${i}.lo`));
const COMPACT = { a: { temperature: 2 as Temperature, action: { kind: 'move' as const, moveId: 'compact', target: 0 } } };

/** The foe's damage to the player in round 1 over `n` seeds, with whether it critted; misses, absorbed hits and substituted moves are dropped. */
function rolls(setup: BattleSetup, n: number): { preview: ReturnType<typeof previewDamage>[]; hits: { amount: number; crit: boolean }[] } {
  const preview: ReturnType<typeof previewDamage>[] = [];
  const hits: { amount: number; crit: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const s = createBattle(setup, seed(i));
    const intent = getIntents(s).find((x) => x.actor === 1);
    if (intent === undefined) throw new Error('no foe intent');
    preview.push(previewDamage(s, intent));
    const r = submitRound(s, COMPACT);
    if ('error' in r) throw new Error(r.error.message);
    const ev: BattleEvent[] = r.events;
    const amount = ev.filter((e) => e.type === 'Damage' && e.actor === 1 && e.target === 0).reduce((n2, e) => n2 + (e.type === 'Damage' ? e.amount : 0), 0);
    // A miss, an absorbed hit, or a move that is not the one telegraphed (hallucination at T3 and T4) is not a roll.
    const used = ev.find((e) => e.type === 'MoveUsed' && e.actor === 1);
    if (used?.type !== 'MoveUsed' || used.moveId !== intent.moveId || used.target !== intent.target) continue;
    if (ev.some((e) => (e.type === 'Missed' && e.actor === 1) || e.type === 'ShieldAbsorbed')) continue;
    hits.push({ amount, crit: ev.some((e) => e.type === 'Crit' && e.actor === 1) });
  }
  return { preview, hits };
}

describe('previewDamage (engine 0.4.2)', () => {
  it('is exported, pure (the state and its rng are untouched) and deterministic', () => {
    expect(api.previewDamage).toBe(previewDamage);
    const s = createBattle(duel(mon('b-orch', 'blitzr'), always('ship-it')), seed(0));
    const before = structuredClone(s);
    const intent = getIntents(s)[0];
    if (intent === undefined) throw new Error('no intent');
    const p = previewDamage(s, intent);
    expect(s).toEqual(before);
    expect(previewDamage(s, intent)).toEqual(p);
    expect(p).not.toBeNull();
  });

  it.each([
    ['Ship It at T2 (85-110%)', 'blitzr', 'ship-it', 2],
    ['Token Burst at T2', 'tokenibble', 'token-burst', 2],
    ['Accept All at T0 (fixed roll)', 'vibrat', 'accept-all', 0],
    ['Merge Conflict at T4 (60-150%)', 'vibrat', 'merge-conflict', 4],
    ['Hard Fork at T3', 'forkling', 'hard-fork', 3],
  ] as const)('%s: every non-crit hit over 300 seeds lies in [min, max], and both ends are rolled', (_name, species, move, temperature) => {
    const { preview, hits } = rolls(duel(mon('b-orch', species), always(move), temperature as Temperature), 300);
    const p = preview[0];
    if (p === null || p === undefined) throw new Error('no preview');
    // The same opening on every seed: the preview does not depend on the seed.
    for (const q of preview) expect(q).toEqual(p);
    const plain = hits.filter((h) => !h.crit).map((h) => h.amount);
    expect(plain.length).toBeGreaterThan(150);
    for (const a of plain) {
      expect(a).toBeGreaterThanOrEqual(p.min);
      expect(a).toBeLessThanOrEqual(p.max);
    }
    expect(Math.min(...plain)).toBe(p.min);
    expect(Math.max(...plain)).toBe(p.max);
    // A crit only ever lands above the range's low end (the preview is "if it does not crit").
    for (const h of hits.filter((x) => x.crit)) expect(h.amount).toBeGreaterThanOrEqual(p.min);
  });

  it('a multi-hit move counts its hits (Swarm of Fine-Tunes: one hit plus one per other Open ally)', () => {
    const foe = mon('b-orch', 'forkling');
    const setup: BattleSetup = { kind: 'wild', a: solo('a', mon('a-orch', 'sagelet')), b: solo('b', foe, { autopilot: { deck: always('swarm-of-fine-tunes'), temperature: 0 } }) };
    const s = createBattle(setup, seed(1));
    const intent = getIntents(s)[0];
    if (intent === undefined) throw new Error('no intent');
    const one = previewDamage(s, intent);
    const r = submitRound(s, COMPACT);
    if ('error' in r) throw new Error(r.error.message);
    const dealt = r.events.filter((e) => e.type === 'Damage' && e.actor === 1).reduce((n, e) => n + (e.type === 'Damage' ? e.amount : 0), 0);
    if (!r.events.some((e) => e.type === 'Crit' || e.type === 'Missed')) expect(dealt).toBe(one?.max);
    expect(one?.min).toBe(one?.max);
  });

  it('is capped at the target HP', () => {
    const s = createBattle(duel(mon('b-orch', 'vibrat', 30), always('segfault'), 0), seed(2));
    const intent = getIntents(s)[0];
    if (intent === undefined) throw new Error('no intent');
    const p = previewDamage(s, intent);
    const hp = (s as BattleState).creatures[0]?.hp;
    expect(p).toEqual({ min: hp, max: hp });
  });

  it('is null for a move that deals no damage to its target: a status move, a self-aimed move, a missing creature', () => {
    const s = createBattle(duel(mon('b-orch', 'blitzr'), always('low-latency', 'self')), seed(3));
    expect(previewDamage(s, { actor: 1, moveId: 'low-latency', target: 1, cardId: null })).toBeNull();
    expect(previewDamage(s, { actor: 1, moveId: 'guardrail', target: 1, cardId: null })).toBeNull();
    expect(previewDamage(s, { actor: 1, moveId: 'ship-it', target: 1, cardId: null })).toBeNull();
    expect(previewDamage(s, { actor: 1, moveId: 'ship-it', target: 9, cardId: null })).toBeNull();
    expect(previewDamage(s, { actor: 1, moveId: 'no-such-move', target: 0, cardId: null })).toBeNull();
  });

  it("a hit shield on the target (Forkling's decoy at battle start) brings the low end to 0", () => {
    const s = createBattle(duel(mon('b-orch', 'blitzr'), always('ship-it'), 2, mon('a-orch', 'forkling')), seed(4));
    const intent = getIntents(s)[0];
    if (intent === undefined) throw new Error('no intent');
    const p = previewDamage(s, intent);
    expect(p?.min).toBe(0);
    expect(p?.max).toBeGreaterThan(0);
  });
});

describe('previewDamage and the Handoff chain', () => {
  it("a chain the user's side holds lifts only the high end: an enemy acting first this round breaks it", () => {
    const s = createBattle(duel(mon('b-orch', 'vibrat'), always('merge-conflict'), 0), seed(5));
    const intent = getIntents(s)[0];
    if (intent === undefined) throw new Error('no intent');
    const plain = previewDamage(s, intent);
    const chained = structuredClone(s);
    chained.handoff = [{ target: 0, side: 'b', actors: [1] }];
    const p = previewDamage(chained, intent);
    expect(p?.min).toBe(plain?.min);
    expect(p?.max).toBeGreaterThan(plain?.max ?? 0);
  });
});
