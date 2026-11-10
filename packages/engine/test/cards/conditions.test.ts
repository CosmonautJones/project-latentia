import { describe, expect, it } from 'vitest';
import { holds } from '../../src/cards/conditions.js';
import type { Condition } from '../../src/cards/model.js';
import { card, vc, view, word } from './helpers.js';

const below50: Condition = { category: 'hp', op: 'below', pct: 50 };
const atLeast50: Condition = { category: 'hp', op: 'atLeast', pct: 50 };

describe('holds: percent thresholds by cross-multiplication', () => {
  it('HP below 50: 50/101 holds (5000 < 5050), 51/101 does not (5100 ≥ 5050)', () => {
    expect(holds(card(below50), view({ self: vc(1, { hp: 50, maxHp: 101 }) }))).toBe(true);
    expect(holds(card(below50), view({ self: vc(1, { hp: 51, maxHp: 101 }) }))).toBe(false);
  });

  it('HP atLeast 50 is the exact complement, and the boundary 50/100 is atLeast, not below', () => {
    expect(holds(card(atLeast50), view({ self: vc(1, { hp: 51, maxHp: 101 }) }))).toBe(true);
    expect(holds(card(atLeast50), view({ self: vc(1, { hp: 50, maxHp: 101 }) }))).toBe(false);
    expect(holds(card(below50), view({ self: vc(1, { hp: 50, maxHp: 100 }) }))).toBe(false);
    expect(holds(card(atLeast50), view({ self: vc(1, { hp: 50, maxHp: 100 }) }))).toBe(true);
  });

  it('25 and 75 use the same comparison', () => {
    expect(holds(card({ category: 'hp', op: 'below', pct: 25 }), view({ self: vc(1, { hp: 24, maxHp: 97 }) }))).toBe(true); // 2400 < 2425
    expect(holds(card({ category: 'hp', op: 'below', pct: 25 }), view({ self: vc(1, { hp: 25, maxHp: 97 }) }))).toBe(false);
    expect(holds(card({ category: 'hp', op: 'atLeast', pct: 75 }), view({ self: vc(1, { hp: 73, maxHp: 97 }) }))).toBe(true); // 7300 ≥ 7275
    expect(holds(card({ category: 'hp', op: 'atLeast', pct: 75 }), view({ self: vc(1, { hp: 72, maxHp: 97 }) }))).toBe(false);
  });

  it('context fill compares tokens held with the window; a zero window counts as full', () => {
    const full75: Condition = { category: 'contextFill', op: 'atLeast', pct: 75 };
    expect(holds(card(full75), view({ self: vc(1, { contextUsed: 9, contextWindow: 12 }) }))).toBe(true); // 900 ≥ 900
    expect(holds(card(full75), view({ self: vc(1, { contextUsed: 8, contextWindow: 12 }) }))).toBe(false);
    expect(holds(card(full75), view({ self: vc(1, { contextUsed: 0, contextWindow: 0 }) }))).toBe(true);
    expect(holds(card({ category: 'contextFill', op: 'below', pct: 25 }), view({ self: vc(1, { contextUsed: 2, contextWindow: 12 }) }))).toBe(true);
  });
});

describe('holds: subjects', () => {
  it('a foe condition holds if ANY living on-field foe matches', () => {
    const v = view({ foes: [vc(6, { isOrchestrator: true }), vc(7, { hp: 20 }), vc(8)] });
    expect(holds(card({ category: 'hp', op: 'below', pct: 25 }, { subject: 'foe' }), v)).toBe(true);
    expect(holds(card({ category: 'hp', op: 'below', pct: 25 }, { subject: 'foe' }), view())).toBe(false);
  });

  it('a foe condition never holds with no foe on the field', () => {
    expect(holds(card({ category: 'hp', op: 'atLeast', pct: 25 }, { subject: 'foe' }), view({ foes: [] }))).toBe(false);
  });

  it('an orchestrator condition reads the allied orchestrator, and never holds once it is KO’d (null)', () => {
    const low = view({ orchestrator: vc(0, { isOrchestrator: true, hp: 10 }) });
    expect(holds(card(below50, { subject: 'orchestrator' }), low)).toBe(true);
    expect(holds(card(below50, { subject: 'orchestrator' }), view())).toBe(false);
    expect(holds(card(below50, { subject: 'orchestrator' }), view({ orchestrator: null }))).toBe(false);
  });

  it('a self condition never holds for a KO’d actor', () => {
    expect(holds(card(below50), view({ self: vc(1, { hp: 0 }) }))).toBe(false);
  });
});

describe('holds: the twelve categories', () => {
  it('status: the subject holds that status (Drift included)', () => {
    expect(holds(card({ category: 'status', status: 'glazed' }), view({ self: vc(1, { statuses: ['glazed'] }) }))).toBe(true);
    expect(holds(card({ category: 'status', status: 'glazed' }), view())).toBe(false);
    expect(holds(card({ category: 'status', status: 'drift' }, { subject: 'foe' }), view({ foes: [vc(7, { statuses: ['drift'] })] }))).toBe(true);
  });

  it('foeType: the subject has the type, or the card’s move is super effective against it', () => {
    const codeFoe = view({ foes: [vc(7, { types: ['code'] })] });
    expect(holds(card({ category: 'foeType', is: 'code' }, { subject: 'foe' }), codeFoe)).toBe(true);
    expect(holds(card({ category: 'foeType', is: 'speed' }, { subject: 'foe' }), codeFoe)).toBe(false);
    // reasoning → code is 15000; reasoning → speed is 6667; system moves are typeless
    expect(holds(card({ category: 'foeType', is: 'weakToMove' }, { subject: 'foe', move: 'chain-of-thought' }), codeFoe)).toBe(true);
    expect(holds(card({ category: 'foeType', is: 'weakToMove' }, { subject: 'foe', move: 'chain-of-thought' }), view({ foes: [vc(7, { types: ['speed'] })] }))).toBe(false);
    expect(holds(card({ category: 'foeType', is: 'weakToMove' }, { subject: 'foe', move: 'compact' }), codeFoe)).toBe(false);
  });

  it('foeLastMove: the subject’s most recent resolved move is that move', () => {
    const v = view({ foes: [vc(7, { lastMove: 'token-burst' }), vc(8)] });
    expect(holds(card({ category: 'foeLastMove', move: 'token-burst' }, { subject: 'foe' }), v)).toBe(true);
    expect(holds(card({ category: 'foeLastMove', move: 'ship-it' }, { subject: 'foe' }), v)).toBe(false);
  });

  it('turn: the round being planned, below or atLeast a round number', () => {
    expect(holds(card({ category: 'turn', op: 'below', round: 3 }), view({ round: 3 }))).toBe(false);
    expect(holds(card({ category: 'turn', op: 'below', round: 4 }), view({ round: 3 }))).toBe(true);
    expect(holds(card({ category: 'turn', op: 'atLeast', round: 3 }), view({ round: 3 }))).toBe(true);
    expect(holds(card({ category: 'turn', op: 'atLeast', round: 4 }), view({ round: 3 }))).toBe(false);
  });

  it('cooldown: the actor has not resolved the card’s move in the last N rounds', () => {
    const cd2 = card({ category: 'cooldown', rounds: 2 }, { move: 'deliberate' });
    expect(holds(cd2, view({ round: 5 }))).toBe(true); // never used
    expect(holds(cd2, view({ round: 5, selfLastUsed: [{ moveId: 'deliberate', round: 3 }] }))).toBe(false); // rounds 3-4
    expect(holds(cd2, view({ round: 5, selfLastUsed: [{ moveId: 'deliberate', round: 2 }] }))).toBe(true);
    expect(holds(cd2, view({ round: 5, selfLastUsed: [{ moveId: 'ship-it', round: 4 }] }))).toBe(true); // another move
  });

  it('allyHp: any living on-field ally other than the actor matches; the subject does not matter', () => {
    const v = view({ allies: [vc(0, { isOrchestrator: true, hp: 80 }), vc(2, { hp: 40 })], foes: [] });
    expect(holds(card({ category: 'allyHp', op: 'below', pct: 50 }), v)).toBe(true);
    expect(holds(card({ category: 'allyHp', op: 'below', pct: 50 }, { subject: 'foe' }), v)).toBe(true);
    expect(holds(card({ category: 'allyHp', op: 'below', pct: 25 }), v)).toBe(false);
    expect(holds(card({ category: 'allyHp', op: 'below', pct: 50 }), view({ self: vc(1, { hp: 1 }), allies: [] }))).toBe(false); // self is not an ally
  });

  it('field: the subject holds a live field effect of that kind', () => {
    const v = view({ self: vc(1, { fields: ['accuracyStages'] }) });
    expect(holds(card({ category: 'field', effect: 'accuracyStages' }), v)).toBe(true);
    expect(holds(card({ category: 'field', effect: 'junkPerRound' }), v)).toBe(false);
  });

  it('foeBuffed: the subject holds a positive stage', () => {
    const buffed = view({ foes: [vc(7, { stages: { compute: 0, robustness: -1, latency: 0, accuracy: 0, evasion: 1 } })] });
    expect(holds(card({ category: 'foeBuffed' }, { subject: 'foe' }), buffed)).toBe(true);
    const debuffed = view({ foes: [vc(7, { stages: { compute: -2, robustness: 0, latency: 0, accuracy: 0, evasion: 0 } })] });
    expect(holds(card({ category: 'foeBuffed' }, { subject: 'foe' }), debuffed)).toBe(false);
  });

  it('telegraphing: the subject is charging a telegraphed move', () => {
    expect(holds(card({ category: 'telegraphing' }, { subject: 'foe' }), view({ foes: [vc(7, { telegraphing: true })] }))).toBe(true);
    expect(holds(card({ category: 'telegraphing' }, { subject: 'foe' }), view())).toBe(false);
  });

  it('coin: hi(r1, 2) === 1 of the actor’s round-start draw; no draws → false', () => {
    const coin: Condition = { category: 'coin' };
    expect(holds(card(coin), view({ roundStart: { r1: word(1, 0), r2: 0 } }))).toBe(true);
    expect(holds(card(coin), view({ roundStart: { r1: word(3, 0xffff), r2: 0 } }))).toBe(true);
    expect(holds(card(coin), view({ roundStart: { r1: word(2, 0xffff), r2: 0 } }))).toBe(false);
    expect(holds(card(coin), view({ roundStart: { r1: word(0, 1), r2: word(1, 1) } }))).toBe(false); // low half and r2 ignored
    expect(holds(card(coin), view())).toBe(false);
  });
});
