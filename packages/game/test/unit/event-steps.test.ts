import { simulate, type BattleEvent, type BattleEventType } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { rivalBattle, trainerBattle, wildBattle } from '../../src/content/battles.js';
import { EVENT_HANDLERS, mapEvent, mapEvents, type MapContext, type UiStep } from '../../src/battle/event-steps.js';
import { STARTERS } from '../../src/flow/flow.js';

const R = 1;
// One sample per engine event type. The mapped type makes the compiler reject a missing or unknown type, so this
// record IS the enumeration of the engine's BattleEvent union.
const SAMPLES: { [K in BattleEventType]: Extract<BattleEvent, { type: K }> } = {
  RoundStart: { round: R, type: 'RoundStart' },
  IntentsPlanned: { round: R, type: 'IntentsPlanned', intents: [{ actor: 1, moveId: 'token-burst', target: 0, cardId: 'jab' }] },
  ActionStarted: { round: R, type: 'ActionStarted', actor: 0, draws: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6 } },
  CardTrace: { round: R, type: 'CardTrace', actor: 1, firedCardId: 'jab', skipped: [] },
  MoveUsed: { round: R, type: 'MoveUsed', actor: 0, moveId: 'happy-to-help', target: 1 },
  Missed: { round: R, type: 'Missed', actor: 0, target: 1 },
  Damage: { round: R, type: 'Damage', actor: 0, target: 1, amount: 7, hpAfter: 13 },
  Crit: { round: R, type: 'Crit', actor: 0, target: 1 },
  TypeEffect: { round: R, type: 'TypeEffect', actor: 0, target: 1, multiplierBp: 20000 },
  StatusApplied: { round: R, type: 'StatusApplied', target: 1, status: 'rateLimited', rounds: 3 },
  StatusBlocked: { round: R, type: 'StatusBlocked', target: 0, status: 'hallucinating' },
  StatusExpired: { round: R, type: 'StatusExpired', target: 1, status: 'rateLimited' },
  StatusCured: { round: R, type: 'StatusCured', target: 1, status: 'quantized' },
  StageChanged: { round: R, type: 'StageChanged', target: 0, stat: 'compute', delta: 1, stageAfter: 1 },
  StageStolen: { round: R, type: 'StageStolen', actor: 0, target: 1, stat: 'latency', amount: 2 },
  Healed: { round: R, type: 'Healed', target: 0, amount: 6, hpAfter: 18 },
  ActionSkipped: { round: R, type: 'ActionSkipped', actor: 0, reason: 'rateLimited' },
  GuardResolved: { round: R, type: 'GuardResolved', actor: 1, target: 0, kind: 'guardrail', blocked: false },
  ShieldAbsorbed: { round: R, type: 'ShieldAbsorbed', target: 0, hitsLeft: 0 },
  FieldEffectStarted: { round: R, type: 'FieldEffectStarted', effect: 'revealIntents', side: 1, target: 1, rounds: 3 },
  FieldEffectEnded: { round: R, type: 'FieldEffectEnded', effect: 'revealIntents', side: 1, target: 1 },
  Revealed: { round: R, type: 'Revealed', actor: 0, target: 1, what: 'nextIntent' },
  ContextAdded: { round: R, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 3, tokensAfter: 5 },
  DriftChanged: { round: R, type: 'DriftChanged', target: 0, drift: 2 },
  Compacted: { round: R, type: 'Compacted', target: 0, tokensBefore: 9, tokensAfter: 4 },
  PieceCompacted: { round: R, type: 'PieceCompacted', target: 0, pieceId: 'skill-k' },
  ObservationGained: { round: R, type: 'ObservationGained', target: 0, observation: 'ship-it' },
  HandoffChain: { round: R, type: 'HandoffChain', actor: 0, chain: [0, 2] },
  Swapped: { round: R, type: 'Swapped', side: 0, outIndex: 1, inIndex: 2 },
  Fainted: { round: R, type: 'Fainted', target: 1 },
  HeadlessMode: { round: R, type: 'HeadlessMode', side: 0, active: true },
  BrittleRepeat: { round: R, type: 'BrittleRepeat', actor: 2, moveId: 'token-nibble' },
  RoundEnd: { round: R, type: 'RoundEnd' },
  BattleEnd: { round: R, type: 'BattleEnd', winner: 0, reason: 'knockout' },
};

const NAMES = ['Sagelet', "Kip's Blitzr", 'Tokenibble'];
const ctx: MapContext = {
  name: (i) => NAMES[i] ?? `#${i}`,
  moveName: (id) => id.toUpperCase(),
  side: (i) => (i === 1 ? 1 : 0),
};

const texts = (steps: readonly UiStep[]) => steps.flatMap((s) => (s.kind === 'text' ? [s.text] : []));

describe('event → UI step mapper', () => {
  it('has a handler for exactly the engine event types', () => {
    expect(Object.keys(EVENT_HANDLERS).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it.each(Object.values(SAMPLES).map((e) => [e.type, e] as const))('%s maps to at least one step, with clean text', (_t, e) => {
    const steps = mapEvent(e, ctx);
    expect(steps.length).toBeGreaterThan(0);
    for (const t of texts(steps)) {
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toMatch(/undefined|NaN|null|\[object/);
    }
  });

  it('a move reads as text, then a windup', () => {
    expect(mapEvent(SAMPLES.MoveUsed, ctx)).toEqual([
      { kind: 'text', text: 'Sagelet used HAPPY-TO-HELP!', weight: 'major' },
      { kind: 'windup', actor: 0 },
    ]);
  });

  it('damage is a hit (hit-stop and white flash) then an HP drain to hpAfter', () => {
    expect(mapEvent(SAMPLES.Damage, ctx)).toEqual([
      { kind: 'hit', target: 1 },
      { kind: 'hp', target: 1, hp: 13 },
    ]);
  });

  it('heals drain the bar upward and say how much', () => {
    const steps = mapEvent(SAMPLES.Healed, ctx);
    expect(steps).toContainEqual({ kind: 'hp', target: 0, hp: 18 });
    expect(texts(steps)).toEqual(['Sagelet recovered 6 HP.']);
  });

  it('statuses turn their icon on and off', () => {
    expect(mapEvent(SAMPLES.StatusApplied, ctx)).toContainEqual({ kind: 'status', target: 1, status: 'rateLimited', on: true });
    expect(mapEvent(SAMPLES.StatusExpired, ctx)).toContainEqual({ kind: 'status', target: 1, status: 'rateLimited', on: false });
    expect(mapEvent(SAMPLES.StatusCured, ctx)).toContainEqual({ kind: 'status', target: 1, status: 'quantized', on: false });
    // A Drift stack is a status icon too, kept in step with the count.
    expect(mapEvent(SAMPLES.DriftChanged, ctx)).toContainEqual({ kind: 'drift', target: 0, drift: 2 });
  });

  it('faint, swap and context changes have their own steps', () => {
    expect(mapEvent(SAMPLES.Fainted, ctx)).toContainEqual({ kind: 'faint', target: 1 });
    expect(mapEvent(SAMPLES.Swapped, ctx)).toContainEqual({ kind: 'swap', side: 0, out: 1, in: 2 });
    expect(mapEvent(SAMPLES.ContextAdded, ctx)).toEqual([{ kind: 'context', target: 0, used: 5 }]);
    expect(mapEvent(SAMPLES.Compacted, ctx)).toContainEqual({ kind: 'context', target: 0, used: 4 });
  });

  it('a failed guard is a Missed on the user itself', () => {
    expect(texts(mapEvent({ ...SAMPLES.Missed, actor: 0, target: 0 }, ctx))).toEqual(["Sagelet's guard failed!"]);
    expect(texts(mapEvent(SAMPLES.Missed, ctx))).toEqual(['Sagelet missed!']);
  });

  it('type effects are worded in house style', () => {
    expect(texts(mapEvent(SAMPLES.TypeEffect, ctx))[0]).toMatch(/on-distribution/i);
    expect(texts(mapEvent({ ...SAMPLES.TypeEffect, multiplierBp: 5000 }, ctx))[0]).toMatch(/out of distribution/i);
    expect(mapEvent({ ...SAMPLES.TypeEffect, multiplierBp: 10000 }, ctx)).toEqual([{ kind: 'beat' }]);
  });

  it('a reveal says who can now see which creature, for the intent preview', () => {
    expect(mapEvent(SAMPLES.Revealed, ctx)).toContainEqual({ kind: 'reveal', target: 1, bySide: 0, what: 'nextIntent' });
    expect(mapEvent({ ...SAMPLES.Revealed, actor: 1, target: 0 }, ctx)).toContainEqual({ kind: 'reveal', target: 0, bySide: 1, what: 'nextIntent' });
  });

  it('the card trace and the battle end are carried through for the scene', () => {
    expect(mapEvent(SAMPLES.CardTrace, ctx)).toEqual([{ kind: 'trace', trace: SAMPLES.CardTrace }]);
    expect(mapEvent(SAMPLES.BattleEnd, ctx)).toContainEqual({ kind: 'end', winner: 0 });
  });

  it('maps every event of real battles without throwing, and every event yields a step', () => {
    let seen = 0;
    for (const s of STARTERS) {
      for (const def of [rivalBattle(s, 0), rivalBattle(s, 1), wildBattle(s, 0), trainerBattle(s, 'spinUp', 'tutorial.a', 0)]) {
        const r = simulate(def.setup, def.seed, { kind: 'autopilot' });
        for (const e of r.events) expect(mapEvent(e, ctx).length).toBeGreaterThan(0);
        expect(mapEvents(r.events, ctx).length).toBeGreaterThanOrEqual(r.events.length);
        seen += r.events.length;
      }
    }
    expect(seen).toBeGreaterThan(100);
  });
});
