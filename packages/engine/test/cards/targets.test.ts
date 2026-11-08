import { describe, expect, it } from 'vitest';
import { resolveTarget } from '../../src/cards/targets.js';
import { vc, view, word } from './helpers.js';

describe('resolveTarget', () => {
  it('self is the actor; a KO’d actor is never a target', () => {
    expect(resolveTarget('self', view(), 'ship-it')).toBe(1);
    expect(resolveTarget('self', view({ self: vc(1, { hp: 0 }) }), 'ship-it')).toBeNull();
  });

  it('orchestrator is the allied orchestrator, null once it is KO’d', () => {
    expect(resolveTarget('orchestrator', view(), 'ship-it')).toBe(0);
    expect(resolveTarget('orchestrator', view({ orchestrator: null, allies: [vc(2)] }), 'ship-it')).toBeNull();
  });

  it('orchestratorTarget is the view’s orchestrator target', () => {
    expect(resolveTarget('orchestratorTarget', view({ orchestratorTarget: 8 }), 'ship-it')).toBe(8);
    expect(resolveTarget('orchestratorTarget', view(), 'ship-it')).toBeNull();
  });

  it('every pick is a living member of the view (Ruling 85): an orchestratorTarget outside it, or KO’d, is null', () => {
    expect(resolveTarget('orchestratorTarget', view({ orchestratorTarget: 99 }), 'ship-it')).toBeNull();
    expect(resolveTarget('orchestratorTarget', view({ orchestratorTarget: 7, foes: [vc(6), vc(7, { hp: 0 }), vc(8)] }), 'ship-it')).toBeNull();
  });

  it('lowestHpAlly counts the actor itself; HP ties go to the lowest canonical index', () => {
    expect(resolveTarget('lowestHpAlly', view({ self: vc(1, { hp: 30 }), allies: [vc(0, { hp: 40 }), vc(2, { hp: 50 })] }), 'hotfix')).toBe(1);
    expect(resolveTarget('lowestHpAlly', view({ self: vc(1, { hp: 30 }), allies: [vc(0, { hp: 40 }), vc(2, { hp: 20 })] }), 'hotfix')).toBe(2);
    expect(resolveTarget('lowestHpAlly', view({ self: vc(1, { hp: 30 }), allies: [vc(0, { hp: 30 }), vc(2, { hp: 30 })] }), 'hotfix')).toBe(0);
    expect(resolveTarget('lowestHpAlly', view({ self: vc(1, { hp: 0 }), allies: [vc(2, { hp: 90 })] }), 'hotfix')).toBe(2);
  });

  it('lowestHpFoe: lowest HP, ties to the lowest canonical index; null with no foe', () => {
    expect(resolveTarget('lowestHpFoe', view({ foes: [vc(6, { hp: 60 }), vc(7, { hp: 40 }), vc(8, { hp: 50 })] }), 'ship-it')).toBe(7);
    expect(resolveTarget('lowestHpFoe', view({ foes: [vc(6, { hp: 60 }), vc(7, { hp: 40 }), vc(8, { hp: 40 })] }), 'ship-it')).toBe(7);
    expect(resolveTarget('lowestHpFoe', view({ foes: [] }), 'ship-it')).toBeNull();
  });

  it('foeWeakToMove picks the highest type multiplier, then the lowest canonical index', () => {
    // chain-of-thought is reasoning: vs speed 5000, vs code 20000, vs open 20000, vs open+code 30000 (clamped)
    const foes = [vc(6, { types: ['speed'] }), vc(7, { types: ['code'] }), vc(8, { types: ['open'] })];
    expect(resolveTarget('foeWeakToMove', view({ foes }), 'chain-of-thought')).toBe(7);
    const dual = [vc(6, { types: ['code'] }), vc(7, { types: ['speed'] }), vc(8, { types: ['open', 'code'] })];
    expect(resolveTarget('foeWeakToMove', view({ foes: dual }), 'chain-of-thought')).toBe(8);
    // no foe is weak: still the best multiplier (neutral beats resisted)
    const resisted = [vc(6, { types: ['speed'] }), vc(7, { types: ['vision'] }), vc(8, { types: ['memory'] })];
    expect(resolveTarget('foeWeakToMove', view({ foes: resisted }), 'chain-of-thought')).toBe(7);
    // a typeless move is neutral against everyone → lowest index
    expect(resolveTarget('foeWeakToMove', view({ foes: dual }), 'compact')).toBe(6);
  });

  it('highestAtkFoe: highest effective Compute, ties to the lowest canonical index', () => {
    expect(resolveTarget('highestAtkFoe', view({ foes: [vc(6, { compute: 40 }), vc(7, { compute: 70 }), vc(8, { compute: 60 })] }), 'ship-it')).toBe(7);
    expect(resolveTarget('highestAtkFoe', view({ foes: [vc(6, { compute: 40 }), vc(7, { compute: 70 }), vc(8, { compute: 70 })] }), 'ship-it')).toBe(7);
  });

  it('randomFoe reads lo(r2, living on-field foes) in canonical order', () => {
    const foes = [vc(6), vc(7), vc(8)];
    expect(resolveTarget('randomFoe', view({ foes, roundStart: { r1: 0, r2: word(0xffff, 0) } }), 'ship-it')).toBe(6); // 0 % 3
    expect(resolveTarget('randomFoe', view({ foes, roundStart: { r1: 0, r2: word(0, 4) } }), 'ship-it')).toBe(7); // 4 % 3
    expect(resolveTarget('randomFoe', view({ foes, roundStart: { r1: 0xffffffff, r2: word(7, 5) } }), 'ship-it')).toBe(8); // 5 % 3
    expect(resolveTarget('randomFoe', view({ foes: [vc(8), vc(6)], roundStart: { r1: 0, r2: word(0, 1) } }), 'ship-it')).toBe(8); // canonical [6, 8]
  });

  it('randomFoe is null with no foe or no round-start draws', () => {
    expect(resolveTarget('randomFoe', view({ foes: [], roundStart: { r1: 0, r2: 0 } }), 'ship-it')).toBeNull();
    expect(resolveTarget('randomFoe', view(), 'ship-it')).toBeNull();
  });
});
