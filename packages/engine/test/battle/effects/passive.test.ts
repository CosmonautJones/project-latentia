import { describe, expect, it } from 'vitest';
import { firePassives } from '../../../src/battle/effects/apply.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { planEntries } from '../../../src/battle/plan.js';
import { submitRound } from '../../../src/battle/round.js';
import { createBattle } from '../../../src/battle/setup.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { Passive } from '../../../src/content/primitives.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { hi, drawRoundStart } from '../../../src/rng/draws.js';
import type { SeedHex } from '../../../src/rng/seed.js';
import { at, battleWithPassives, faint, gridlessSetup, mon, word } from '../helpers.js';
import { ofType, run } from './kit.js';

// Species passives (spec §6 passive, Ruling 57): battleStart at createBattle; afterFirstAction right after
// the creature's first action, before the per-action win check; roundEnd at the start of end of round;
// statusIncoming inside status application; notKoThisRound at end of round for creatures still alive.
// Chance procs read hi(r2, 100) of that round.

function ok(s: BattleState, cmd: RoundCommand = {}): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(s, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

/** createBattle's state at 500/500 HP with every shield removed, in round 1 with neutral round-start draws. */
function blitzrReady(): BattleState {
  const s = battleWithPassives();
  s.round = 1;
  for (const c of s.creatures) {
    c.hp = c.maxHp = 500;
    c.shields = [];
    c.roundStart = { r1: 0, r2: word(99, 0) };
  }
  return s;
}

describe('Blitzr — Move Fast', () => {
  it('createBattle queues +1 priority on every Blitzr, used up by its first Sort only', () => {
    const s = battleWithPassives();
    for (const i of [1, 5, 7, 11]) expect(at(s, i).nextActionMods).toEqual([{ kind: 'priority', delta: 1 }]);
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    for (const c of s.creatures) c.roundStart = { r1: 0, r2: word(99, 0) };
    s.round = 1;
    expect(planEntries(s, {}).find((e) => e.actor === 1)?.priority).toBe(1);
    s.round = 0;
    const { state } = ok(s);
    expect(at(state, 1).nextActionMods).toEqual([]);
    expect(planEntries(state, {}).find((e) => e.actor === 1)?.priority).toBe(0);
    // A benched Blitzr has had no Sort yet: it keeps its modifier.
    expect(at(state, 5).nextActionMods).toEqual([{ kind: 'priority', delta: 1 }]);
  });

  it('hi(r2, 100) = 14 on its first action: recoil of 10% of the damage it dealt', () => {
    const s = blitzrReady();
    at(s, 1).stats.compute = 300; // a hit of at least 10, so 10% recoil is at least 1
    at(s, 1).roundStart = { r1: 0, r2: word(14, 0) };
    const events = run(s, 1, 'ship-it', 7);
    const [hit, recoil] = ofType(events, 'Damage');
    expect(hit).toMatchObject({ actor: 1, target: 7 });
    expect(recoil).toEqual({ round: 1, type: 'Damage', actor: 1, target: 1, amount: Math.floor(((hit?.amount ?? 0) * 10) / 100), hpAfter: 500 - Math.floor(((hit?.amount ?? 0) * 10) / 100) });
    expect(recoil?.amount).toBeGreaterThan(0);
    // Only the first action: no recoil later, whatever the proc value.
    at(s, 1).roundStart = { r1: 0, r2: word(0, 0) };
    expect(ofType(run(s, 1, 'ship-it', 7), 'Damage')).toHaveLength(1);
  });

  it('hi(r2, 100) = 15: no recoil, and the passive is spent', () => {
    const s = blitzrReady();
    at(s, 1).roundStart = { r1: 0, r2: word(15, 0) };
    expect(ofType(run(s, 1, 'ship-it', 7), 'Damage')).toHaveLength(1);
    at(s, 1).roundStart = { r1: 0, r2: word(0, 0) };
    expect(ofType(run(s, 1, 'ship-it', 7), 'Damage')).toHaveLength(1);
  });

  it('a first action that deals no damage spends it with no recoil', () => {
    const s = blitzrReady();
    at(s, 1).roundStart = { r1: 0, r2: word(0, 0) };
    expect(ofType(run(s, 1, 'low-latency', 1), 'Damage')).toEqual([]);
    expect(ofType(run(s, 1, 'ship-it', 7), 'Damage')).toHaveLength(1);
  });
});

describe('Slopling — +1 Compute stage at the end of each round it is not KO’d', () => {
  const slopSetup = () => gridlessSetup({ active: [mon('a-act1', 'slopling'), mon('a-act2', 'forkling')], bench: [mon('a-b1', 'slopling')] });

  function sloppy(): BattleState {
    const s = createBattle(slopSetup(), '0123456789abcdef0123456789abcdef');
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    return s;
  }

  it('gains a stage at end of every round, after every action, on the field only (Ruling 60)', () => {
    const r1 = ok(sloppy());
    const gains = (events: BattleEvent[]) => ofType(events, 'StageChanged').filter((e) => e.stat === 'compute' && (e.target === 1 || e.target === 3));
    expect(gains(r1.events).map((e) => [e.target, e.stageAfter])).toEqual([[1, 1]]); // 3 is benched
    expect(r1.events.indexOf(gains(r1.events)[0] as BattleEvent)).toBeGreaterThan(r1.events.map((e) => e.type).lastIndexOf('ActionStarted'));
    const r2 = ok(r1.state);
    expect(gains(r2.events).map((e) => [e.target, e.stageAfter])).toEqual([[1, 2]]);
    expect(at(r2.state, 3).stages.compute).toBe(0);
  });

  it('a Slopling KO’d by its status tick that round gains nothing (the check follows the ticks)', () => {
    const s = sloppy();
    at(s, 1).statuses.push({ id: 'deprecated', remaining: 1 });
    faint(at(s, 3));
    faint(at(s, 4));
    faint(at(s, 5));
    const { events } = ok(s);
    expect(ofType(events, 'Fainted').map((e) => e.target)).toContain(1);
    expect(ofType(events, 'StageChanged').filter((e) => e.target === 1 && e.stat === 'compute')).toEqual([]);
  });
});

describe('firePassives', () => {
  it('a oncePerBattle passive fires once', () => {
    const s = blitzrReady();
    const passives: Passive[] = [{ kind: 'passive', trigger: 'roundEnd', oncePerBattle: true, effects: [{ kind: 'stage', who: 'self', op: 'add', stat: 'latency', delta: 1 }] }];
    const events: BattleEvent[] = [];
    firePassives(s, at(s, 2), passives, 'roundEnd', events, null);
    firePassives(s, at(s, 2), passives, 'roundEnd', events, null);
    expect(ofType(events, 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 2, stat: 'latency', delta: 1, stageAfter: 1 }]);
    expect(at(s, 2).passivesUsed).toEqual([0]);
  });

  it('only the passives of the trigger fire, and none for a KO’d creature', () => {
    const s = blitzrReady();
    const passives: Passive[] = [{ kind: 'passive', trigger: 'roundEnd', effects: [{ kind: 'stage', who: 'self', op: 'add', stat: 'latency', delta: 1 }] }];
    const events: BattleEvent[] = [];
    firePassives(s, at(s, 2), passives, 'notKoThisRound', events, null);
    faint(at(s, 8));
    firePassives(s, at(s, 8), passives, 'roundEnd', events, null);
    expect(events).toEqual([]);
  });
});

describe('both sides KO’d by one action → draw (Review Focus 5)', () => {
  // Side A: only Blitzr (1) alive at 1 HP, Compute raised so Ship It surely KOs. Side B: only Forkling (8)
  // alive at 10 HP, decoy removed. Both orchestrators are KO'd (headless skips). Blitzr's Move Fast (+1) acts
  // first; Ship It deals 10 and KOs Forkling, then its first-action recoil proc (hi(r2, 100) < 15 in this
  // seed's round 1) deals floor(10 × 10%) = 1 → KO, before the per-action win check (Ruling 57).
  const DRAW_SEED = '00000000000000000000000000000005' as SeedHex;

  function crafted(): BattleState {
    const s = createBattle(gridlessSetup(), DRAW_SEED);
    for (const c of s.creatures) if (c.index !== 1 && c.index !== 8) faint(c);
    s.sides.a.headless = true;
    s.sides.b.headless = true;
    at(s, 1).hp = 1;
    at(s, 1).stats.compute = 300;
    at(s, 8).hp = 10;
    at(s, 8).shields = [];
    return s;
  }

  it('the seed’s round-1 proc value for Blitzr is below 15 (precondition)', () => {
    const rng = structuredClone(crafted().rng);
    drawRoundStart(rng);
    expect(hi(drawRoundStart(rng).r2, 100)).toBeLessThan(15);
  });

  it('ends in a draw with exactly one BattleEnd, and nothing resolves after the double KO', () => {
    const { state, events } = ok(crafted());
    expect(state).toMatchObject({ ended: true, result: 'draw' });
    // Blitzr resolves first (+1), and the double KO cuts the round short: no other entry draws or acts.
    expect(ofType(events, 'ActionStarted').map((e) => e.actor)).toEqual([1]);
    expect(events.filter((e) => ['MoveUsed', 'Damage', 'Fainted', 'RoundEnd', 'BattleEnd'].includes(e.type))).toEqual([
      { round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 8 },
      { round: 1, type: 'Damage', actor: 1, target: 8, amount: 10, hpAfter: 0 },
      { round: 1, type: 'Fainted', target: 8 },
      { round: 1, type: 'Damage', actor: 1, target: 1, amount: 1, hpAfter: 0 },
      { round: 1, type: 'Fainted', target: 1 },
      { round: 1, type: 'RoundEnd' },
      { round: 1, type: 'BattleEnd', winner: null, reason: 'knockout' },
    ]);
    expect(ofType(events, 'BattleEnd')).toHaveLength(1);
  });
});
