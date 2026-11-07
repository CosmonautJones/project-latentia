import { describe, expect, it } from 'vitest';
import { moveDef } from '../../../src/content/moves.js';
import type { MoveDef } from '../../../src/content/primitives.js';
import { typeMultiplierBp } from '../../../src/content/types.js';
import { effectContext } from '../../../src/battle/effects/context.js';
import { guardCheck } from '../../../src/battle/effects/guard.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { at, battle, draws } from '../helpers.js';
import { dealt, expected, fresh, ofType, run } from './kit.js';

// 1 a-act1 blitzr (speed) guards; 7 b-act1 blitzr and 8 b-act2 forkling (open) attack it.
const SPEED_ON_SPEED = typeMultiplierBp('speed', ['speed']);
const OPEN_ON_SPEED = typeMultiplierBp('open', ['speed']);

describe('Captcha Wall', () => {
  it('makes a Speed move a miss and halves every other attack (Guard 5000)', () => {
    const s = fresh();
    run(s, 1, 'captcha-wall', 1);
    expect(at(s, 1).guard).not.toBeNull();
    const speed = run(s, 7, 'ship-it', 1);
    expect(speed.slice(2)).toEqual([
      { round: 1, type: 'GuardResolved', actor: 7, target: 1, kind: 'captchaWall', blocked: true },
      { round: 1, type: 'Missed', actor: 7, target: 1 },
      { round: 1, type: 'ContextAdded', target: 1, kind: 'observation', tokens: 1, tokensAfter: 2 },
      { round: 1, type: 'ObservationGained', target: 1, observation: 'ship-it' },
    ]);
    expect(at(s, 1).hp).toBe(500);
    const other = run(s, 8, 'hard-fork', 1);
    expect(ofType(other, 'GuardResolved')).toEqual([{ round: 1, type: 'GuardResolved', actor: 8, target: 1, kind: 'captchaWall', blocked: false }]);
    expect(dealt(other)).toEqual([expected(s, 8, 1, 70, { type: OPEN_ON_SPEED, native: 12500, roll: 10000, guard: 5000 })]);
  });
});

describe('Captcha Wall blocks every Speed-type move, of any power (Ruling 56)', () => {
  it('a crafted Speed status move aimed at the guarded creature is blocked as a miss', () => {
    const s = fresh();
    run(s, 1, 'captcha-wall', 1);
    const throttle = moveDef('throttle') as MoveDef;
    const speedStatus: MoveDef = { ...throttle, id: 'speed-throttle', type: 'speed' };
    const events: BattleEvent[] = [];
    const ctx = effectContext(s, 7, 1, speedStatus, draws(), 2, events);
    expect(guardCheck(ctx, speedStatus.effects, at(s, 7), at(s, 1))).toBe(false);
    expect(events).toEqual([
      { round: 1, type: 'GuardResolved', actor: 7, target: 1, kind: 'captchaWall', blocked: true },
      { round: 1, type: 'Missed', actor: 7, target: 1 },
    ]);
    const plainStatus = effectContext(s, 7, 1, throttle, draws(), 2, []);
    expect(guardCheck(plainStatus, throttle.effects, at(s, 7), at(s, 1))).toBe(true); // a non-Speed status move passes
  });
});

describe('guards are cleared at end of round (Ruling 56)', () => {
  it('leaves no guard object on any creature after the round', () => {
    const r = submitRound(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'guardrail', target: 0 } } });
    if ('error' in r) throw new Error(r.error.message);
    expect(r.events.some((e) => e.type === 'MoveUsed' && e.actor === 0 && e.moveId === 'guardrail')).toBe(true);
    expect(r.state.creatures.map((c) => c.guard)).toEqual(r.state.creatures.map(() => null));
  });
});

describe('Guardrail', () => {
  it('halves damage and blocks status moves', () => {
    const s = fresh();
    run(s, 1, 'guardrail', 1);
    const hit = run(s, 7, 'ship-it', 1);
    expect(ofType(hit, 'GuardResolved')).toEqual([{ round: 1, type: 'GuardResolved', actor: 7, target: 1, kind: 'guardrail', blocked: false }]);
    expect(dealt(hit)).toEqual([expected(s, 7, 1, 65, { type: SPEED_ON_SPEED, native: 12500, roll: 10000, guard: 5000 })]);
    const status = run(s, 8, 'throttle', 1);
    expect(ofType(status, 'GuardResolved')).toEqual([{ round: 1, type: 'GuardResolved', actor: 8, target: 1, kind: 'guardrail', blocked: true }]);
    expect(ofType(status, 'StatusApplied')).toEqual([]);
    expect(at(s, 1).statuses).toEqual([]);
  });

  it('lasts only for the round it was raised in', () => {
    const s = fresh();
    run(s, 1, 'guardrail', 1);
    s.round = 2;
    expect(ofType(run(s, 7, 'ship-it', 1), 'GuardResolved')).toEqual([]);
  });
});

describe('Refusal', () => {
  it("blocks one attack, lets the next through, and sets a 5000 penalty on the user's next move", () => {
    const s = fresh();
    run(s, 1, 'refusal', 1);
    expect(at(s, 1).nextActionMods).toEqual([{ kind: 'powerBp', bp: 5000 }]);
    const blocked = run(s, 7, 'ship-it', 1);
    expect(ofType(blocked, 'GuardResolved')).toEqual([{ round: 1, type: 'GuardResolved', actor: 7, target: 1, kind: 'refusal', blocked: true }]);
    expect(ofType(blocked, 'Missed')).toEqual([]);
    expect(dealt(blocked)).toEqual([]);
    const through = run(s, 8, 'hard-fork', 1);
    expect(ofType(through, 'GuardResolved')).toEqual([]);
    expect(dealt(through)).toEqual([expected(s, 8, 1, 70, { type: OPEN_ON_SPEED, native: 12500, roll: 10000 })]);
    // The penalty lands as the step-4 Refusal modifier on the user's next move, then is used up.
    expect(dealt(run(s, 1, 'ship-it', 7))).toEqual([expected(s, 1, 7, 65, { type: SPEED_ON_SPEED, native: 12500, roll: 10000, refusalOrApology: 5000 })]);
    expect(at(s, 1).nextActionMods).toEqual([]);
  });

  it('a failed guard skips the rest of the move: no guard, no penalty', () => {
    const s = fresh();
    at(s, 1).guardStreak = 1;
    const failed = run(s, 1, 'refusal', 1, { d3lo: 243 });
    expect(failed.slice(-1)).toEqual([{ round: 1, type: 'Missed', actor: 1, target: 1 }]);
    expect(at(s, 1)).toMatchObject({ guard: null, nextActionMods: [], guardStreak: 2 });
  });
});

describe('guard streak (guardSucceeds: lo(d3, 729) < [729, 243, 81, 27, 9, 3][k])', () => {
  const guardUp = (k: number, d3lo: number) => {
    const s = fresh();
    at(s, 1).guardStreak = k;
    run(s, 1, 'guardrail', 1, { d3lo });
    return { up: at(s, 1).guard !== null, streak: at(s, 1).guardStreak };
  };

  it('always succeeds on a first use and falls to 1/3, 1/9 … on consecutive uses; k ≥ 6 always fails', () => {
    expect(guardUp(0, 728)).toEqual({ up: true, streak: 1 });
    expect(guardUp(1, 242)).toEqual({ up: true, streak: 2 });
    expect(guardUp(1, 243)).toEqual({ up: false, streak: 2 });
    expect(guardUp(2, 80)).toEqual({ up: true, streak: 3 });
    expect(guardUp(2, 81)).toEqual({ up: false, streak: 3 });
    expect(guardUp(5, 729 * 2 + 2)).toEqual({ up: true, streak: 6 }); // lo(d3, 729) = 2 < 3: the modulus is 729
    expect(guardUp(5, 3)).toEqual({ up: false, streak: 6 });
    expect(guardUp(6, 0)).toEqual({ up: false, streak: 7 });
  });

  it('shares one counter across guard kinds and resets on any non-guard move', () => {
    const s = fresh();
    run(s, 1, 'guardrail', 1);
    run(s, 1, 'captcha-wall', 1);
    expect(at(s, 1).guardStreak).toBe(2);
    run(s, 1, 'ship-it', 7);
    expect(at(s, 1).guardStreak).toBe(0);
  });
});

describe('Unit Test', () => {
  it('reflects at 50% a move that hit the user last round; other moves pass through', () => {
    const s = fresh();
    s.round = 2;
    at(s, 7).moveHistory.push({ round: 1, moveId: 'ship-it', target: 1, damaged: [1] });
    run(s, 1, 'unit-test', 1);
    const full = expected(s, 7, 1, 65, { type: SPEED_ON_SPEED, native: 12500, roll: 10000 });
    const reflected = run(s, 7, 'ship-it', 1);
    expect(ofType(reflected, 'GuardResolved')).toEqual([{ round: 2, type: 'GuardResolved', actor: 7, target: 1, kind: 'unitTest', blocked: true }]);
    expect(ofType(reflected, 'Damage')).toEqual([{ round: 2, type: 'Damage', actor: 1, target: 7, amount: Math.floor(full / 2), hpAfter: 500 - Math.floor(full / 2) }]);
    expect(at(s, 1).hp).toBe(500);
    const fresh2 = run(s, 7, 'token-burst', 1);
    expect(ofType(fresh2, 'GuardResolved')).toEqual([]);
    expect(dealt(fresh2)).toHaveLength(1);
    expect(at(s, 1).hp).toBeLessThan(500);
  });
});
