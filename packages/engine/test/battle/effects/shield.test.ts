import { describe, expect, it } from 'vitest';
import { applyEffect } from '../../../src/battle/effects/apply.js';
import { effectContext } from '../../../src/battle/effects/context.js';
import { createBattle } from '../../../src/battle/setup.js';
import { MOVES } from '../../../src/content/moves.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { draws } from '../helpers.js';
import { at, gridlessSetup, mon, SEED } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

// shield (spec §6): absorbs the holder's next `count` incoming hits (ShieldAbsorbed) or status applications
// (StatusBlocked). Forkling's decoy and Sagelet's Disclaimer are battleStart shields of one.

describe('hit shield (Forkling’s decoy)', () => {
  it('createBattle gives every Forkling a one-hit shield', () => {
    const s = createBattle(gridlessSetup(), SEED);
    expect(at(s, 2).shields).toEqual([{ against: 'hit', count: 1 }]);
    expect(at(s, 8).shields).toEqual([{ against: 'hit', count: 1 }]);
  });

  it('absorbs exactly one hit: no damage, no Crit/TypeEffect, no Handoff; the next hit lands', () => {
    const s = fresh();
    at(s, 8).shields = [{ against: 'hit', count: 1 }];
    const first = run(s, 0, 'happy-to-help', 8, { d4lo: 0 });
    expect(first.filter((e) => ['ShieldAbsorbed', 'Damage', 'Crit', 'TypeEffect', 'HandoffChain'].includes(e.type))).toEqual([
      { round: 1, type: 'ShieldAbsorbed', target: 8, hitsLeft: 0 },
    ]);
    expect(at(s, 8)).toMatchObject({ hp: 500, shields: [] });
    expect(ofType(run(s, 0, 'happy-to-help', 8), 'Damage')).toHaveLength(1);
  });

  it('a multi-hit move loses only the absorbed hit', () => {
    const s = fresh();
    at(s, 8).shields = [{ against: 'hit', count: 1 }];
    // Speculative Decoding: 2 + hi(D5, 4) hits; hi(D5) = 1 → 3 hits.
    const events = run(s, 1, 'speculative-decoding', 8, { d5hi: 1 });
    expect(ofType(events, 'ShieldAbsorbed')).toHaveLength(1);
    expect(ofType(events, 'Damage')).toHaveLength(2);
  });

  it('a pending Earnest Apology is not spent on an absorbed hit', () => {
    const s = fresh();
    at(s, 8).shields = [{ against: 'hit', count: 1 }];
    at(s, 8).nextActionMods = [{ kind: 'incomingDamageBp', bp: 7000 }];
    run(s, 0, 'happy-to-help', 8);
    expect(at(s, 8).nextActionMods).toEqual([{ kind: 'incomingDamageBp', bp: 7000 }]);
  });
});

describe('status shield (Sagelet’s Disclaimer)', () => {
  it('createBattle gives every Sagelet a one-status shield', () => {
    const s = createBattle(gridlessSetup({ active: [mon('a-act1', 'sagelet'), mon('a-act2', 'forkling')] }), SEED);
    expect(at(s, 0).shields).toEqual([{ against: 'status', count: 1 }]);
    expect(at(s, 1).shields).toEqual([{ against: 'status', count: 1 }]);
  });

  it('blocks the first status that would land (StatusBlocked); the next one lands', () => {
    const s = fresh();
    at(s, 0).shields = [{ against: 'status', count: 1 }];
    expect(ofType(run(s, 7, 'throttle', 0), 'StatusBlocked')).toEqual([{ round: 1, type: 'StatusBlocked', target: 0, status: 'rateLimited' }]);
    expect(at(s, 0)).toMatchObject({ statuses: [], shields: [] });
    expect(ofType(run(s, 7, 'throttle', 0), 'StatusApplied')).toHaveLength(1);
  });

  it('is not spent on a status that would be blocked anyway', () => {
    const s = fresh();
    at(s, 0).shields = [{ against: 'status', count: 1 }];
    at(s, 0).statuses.push({ id: 'quantized', remaining: 2 });
    expect(ofType(run(s, 7, 'throttle', 0), 'StatusBlocked')).toHaveLength(1);
    expect(at(s, 0).shields).toEqual([{ against: 'status', count: 1 }]);
  });

  it('Drift is not a status for Disclaimer (Ruling 64): a Drift stack lands and the shield stays', () => {
    const s = fresh();
    at(s, 0).shields = [{ against: 'status', count: 1 }];
    const events: BattleEvent[] = [];
    const ctx = effectContext(s, 7, 0, MOVES.throttle, draws(), 2, events);
    applyEffect(ctx, { kind: 'applyStatus', who: 'target', status: 'drift' });
    expect(events).toEqual([{ round: 1, type: 'DriftChanged', target: 0, drift: 1 }]);
    expect(at(s, 0).shields).toEqual([{ against: 'status', count: 1 }]);
  });

  it('a hit shield does not stop statuses, nor a status shield hits', () => {
    const s = fresh();
    at(s, 8).shields = [{ against: 'hit', count: 1 }];
    expect(ofType(run(s, 1, 'throttle', 8), 'StatusApplied')).toHaveLength(1);
    at(s, 0).shields = [{ against: 'status', count: 1 }];
    expect(ofType(run(s, 7, 'ship-it', 0), 'Damage')).toHaveLength(1);
  });
});
