import { describe, expect, it } from 'vitest';
import { defaultIntent, planEntries } from '../../../src/battle/order.js';
import { resolveEntry, submitRound } from '../../../src/battle/round.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { drawRoundStart, lo } from '../../../src/rng/draws.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import type { BattleState } from '../../../src/battle/state.js';
import { at, battle, entry, rngWhere } from '../helpers.js';
import { dealt, fresh, ofType, run } from './kit.js';

describe('applyStatus', () => {
  it('applies a fixed-duration status; re-applying a held one is StatusBlocked', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'throttle', 7), 'StatusApplied')).toEqual([{ round: 1, type: 'StatusApplied', target: 7, status: 'rateLimited', rounds: 3 }]);
    expect(ofType(run(s, 1, 'throttle', 7), 'StatusBlocked')).toEqual([{ round: 1, type: 'StatusBlocked', target: 7, status: 'rateLimited' }]);
  });

  it('a rider applies on lo(d6, 100) < pct with a random duration from hi(d6): Hallucinating 2 + hi % 3', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'adversarial-patch', 7, { d6lo: 30, d6hi: 2 }), 'StatusApplied')).toEqual([]);
    expect(ofType(run(s, 1, 'adversarial-patch', 7, { d6lo: 29, d6hi: 5 }), 'StatusApplied')).toEqual([
      { round: 1, type: 'StatusApplied', target: 7, status: 'hallucinating', rounds: 4 },
    ]);
  });

  it('Glazed remembers its glazer; Overfit starts locked onto the victim’s last target', () => {
    const s = fresh();
    run(s, 1, 'flattery', 7);
    expect(at(s, 7).statuses).toEqual([{ id: 'glazed', remaining: 3, source: 1 }]);
    at(s, 8).moveHistory.push({ round: 0, moveId: 'hard-fork', target: 2, damaged: [2] });
    run(s, 1, 'infinite-loop', 8);
    expect(at(s, 8).statuses).toEqual([{ id: 'overfit', remaining: 2, source: 2 }]);
  });
});

describe('Prompt Injected (Ruling 19)', () => {
  it("stores the inflicter's command injection", () => {
    const s = fresh();
    run(s, 1, 'deepfake-call', 7, {}, { injection: { moveId: 'token-burst', target: 8 } });
    expect(at(s, 7).statuses).toEqual([{ id: 'promptInjected', remaining: 1, injected: { moveId: 'token-burst', target: 8 } }]);
  });

  it("defaults to the victim's highest-power move against the victim's lowest-HP ally", () => {
    const s = fresh();
    at(s, 8).hp = 300; // b-act2 is b-act1's lowest-HP ally (b-orch is at 500)
    run(s, 1, 'deepfake-call', 7);
    // Blitzr: ship-it 65, token-burst 40, low-latency —, distilled-strike 75.
    expect(at(s, 7).statuses[0]?.injected).toEqual({ moveId: 'distilled-strike', target: 8 });
  });

  it("an injection naming a move the victim does not know falls back to the default", () => {
    const s = fresh();
    run(s, 1, 'deepfake-call', 7, {}, { injection: { moveId: 'hard-fork', target: 8 } });
    expect(at(s, 7).statuses[0]?.injected?.moveId).toBe('distilled-strike');
  });

  it("replaces the victim's next action, aimed even at its own ally, and is consumed when it resolves", () => {
    const s = fresh();
    run(s, 1, 'deepfake-call', 7, {}, { injection: { moveId: 'token-burst', target: 8 } });
    const hijacked = run(s, 7, 'ship-it', 1);
    expect(hijacked.slice(0, 2)).toEqual([
      { round: 1, type: 'StatusExpired', target: 7, status: 'promptInjected' },
      { round: 1, type: 'MoveUsed', actor: 7, moveId: 'token-burst', target: 8 },
    ]);
    expect(ofType(hijacked, 'Damage').map((e) => e.target)).toEqual([8]);
    expect(at(s, 7).statuses).toEqual([]);
    expect(ofType(run(s, 7, 'ship-it', 1), 'MoveUsed')[0]?.moveId).toBe('ship-it');
  });

  it('a skipped action does not consume it', () => {
    const s = fresh();
    run(s, 1, 'deepfake-call', 7);
    at(s, 7).statuses.push({ id: 'rateLimited', remaining: 3 });
    s.rng = rngWhere((d) => lo(d.d2, 100) === 0); // resolveEntry owns the Rate Limited skip (Ruling 74)
    const events: BattleEvent[] = [];
    resolveEntry(s, entry(7, 'ship-it', 1), events);
    expect(events.slice(1)).toEqual([{ round: 1, type: 'ActionSkipped', actor: 7, reason: 'rateLimited' }]);
    expect(at(s, 7).statuses.map((x) => x.id)).toContain('promptInjected');
  });

  it('with no on-field ally, the default aims the injected move by its default selector (not at the victim)', () => {
    const s = fresh();
    for (const i of [6, 8]) Object.assign(at(s, i), { hp: 0, fainted: true }); // b-act1 has no living ally on the field
    at(s, 2).hp = 100; // the lowest-HP foe of b-act1
    run(s, 1, 'deepfake-call', 7);
    expect(at(s, 7).statuses[0]?.injected).toEqual({ moveId: 'distilled-strike', target: 2 });
  });

  it('Guardrail blocks it', () => {
    const s = fresh();
    run(s, 7, 'guardrail', 7);
    expect(ofType(run(s, 1, 'deepfake-call', 7), 'GuardResolved')).toHaveLength(1);
    expect(at(s, 7).statuses).toEqual([]);
  });
});

describe('cure', () => {
  it('Hotfix cures major statuses on its target, then heals', () => {
    const s = fresh();
    at(s, 1).hp = 100;
    at(s, 1).statuses.push({ id: 'rateLimited', remaining: 2 }, { id: 'glazed', remaining: 2, source: 7 });
    const events = run(s, 2, 'hotfix', 1);
    expect(ofType(events, 'StatusCured')).toEqual([{ round: 1, type: 'StatusCured', target: 1, status: 'rateLimited' }]);
    expect(ofType(events, 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 75, hpAfter: 175 }]);
    expect(at(s, 1).statuses.map((x) => x.id)).toEqual(['glazed']);
  });

  it('a Search hit cures Hallucinating on its target', () => {
    const s = fresh();
    at(s, 7).statuses.push({ id: 'hallucinating', remaining: 2 });
    expect(dealt(run(s, 1, 'retrieval-strike', 7))).toHaveLength(1);
    expect(at(s, 7).statuses).toEqual([]);
  });
});

describe('Rate Limited halves Latency at Sort', () => {
  it('plans a Rate Limited creature at floor(Latency × 5000 / 10000)', () => {
    const s = fresh();
    for (const c of s.creatures) c.roundStart = drawRoundStart(s.rng);
    at(s, 1).statuses.push({ id: 'rateLimited', remaining: 3 });
    const latency = (i: number) => planEntries(s, {}).find((e) => e.actor === i)?.latency;
    expect(latency(7)).toBe(at(s, 7).stats.latency);
    expect(latency(1)).toBe(Math.floor(at(s, 1).stats.latency / 2));
  });
});

describe('moves disabled by status (Ruling 50)', () => {
  const commanded = (moveId: string, target: number) => ({ a: { temperature: 2 as const, action: { kind: 'move' as const, moveId, target } } });
  const code = (r: ReturnType<typeof submitRound>) => ('error' in r ? r.error.code : null);

  it('rejects a commanded orchestrator move that Glazed or Overfit forbids with moveDisabled', () => {
    const glazed = battle();
    at(glazed, 0).statuses.push({ id: 'glazed', remaining: 3, source: 7 });
    expect(code(submitRound(glazed, commanded('step-back-prompt', 0)))).toBe('moveDisabled');
    expect(code(submitRound(glazed, commanded('happy-to-help', 7)))).toBeNull();
    const overfit = battle();
    at(overfit, 0).statuses.push({ id: 'overfit', remaining: 2, source: 7 });
    at(overfit, 0).lastMoveId = 'chain-of-thought';
    expect(code(submitRound(overfit, commanded('happy-to-help', 7)))).toBe('moveDisabled');
    expect(code(submitRound(overfit, commanded('chain-of-thought', 7)))).toBeNull();
  });

  it('the default intent skips disabled moves', () => {
    const s = battle();
    at(s, 1).statuses.push({ id: 'overfit', remaining: 2, source: 7 });
    at(s, 1).lastMoveId = 'distilled-strike';
    expect(defaultIntent(s, 1).moveId).toBe('distilled-strike');
    at(s, 1).lastMoveId = 'guardrail'; // a universal last move: nothing else is allowed
    expect(defaultIntent(s, 1).moveId).toBe('guardrail');
  });
});

describe('Prompt Injected on an orchestrator overrides any command (Ruling 53)', () => {
  const injected = (): BattleState => {
    const s = battle();
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    at(s, 0).statuses.push({ id: 'promptInjected', remaining: 1, injected: { moveId: 'happy-to-help', target: 1 } });
    return s;
  };
  const hijack = (action: RoundCommand['a']) => {
    const r = submitRound(injected(), action === undefined ? {} : { a: action });
    if ('error' in r) throw new Error(r.error.message);
    const i = r.events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 0);
    return { r, after: r.events.slice(i + 1, i + 3) };
  };
  const HIJACKED = [
    { round: 1, type: 'StatusExpired', target: 0, status: 'promptInjected' },
    { round: 1, type: 'MoveUsed', actor: 0, moveId: 'happy-to-help', target: 1 },
  ];

  it('a none command is hijacked, and the injection is consumed', () => {
    const { r, after } = hijack({ temperature: 2, action: { kind: 'none' } });
    expect(after).toEqual(HIJACKED);
    expect(at(r.state, 0).statuses).toEqual([]);
  });

  it('a Swap command is hijacked: no swap happens, and the injection is consumed', () => {
    const { r, after } = hijack({ temperature: 2, action: { kind: 'swap', out: 1, in: 3 } });
    expect(after).toEqual(HIJACKED);
    expect(ofType(r.events, 'Swapped')).toEqual([]);
    expect(r.state.sides.a.slots[0]?.occupant).toBe(1);
    expect(at(r.state, 0).statuses).toEqual([]);
  });
});

describe('command injection validation (Ruling 54)', () => {
  const code = (injection: { moveId: string; target: number }) => {
    const r = submitRound(battle(), { a: { temperature: 2, action: { kind: 'move', moveId: 'happy-to-help', target: 7, injection } } });
    return 'error' in r ? r.error.code : null;
  };

  it('rejects an injection with a non-canonical target or an unknown move as invalidCommand', () => {
    expect(code({ moveId: 'ship-it', target: Number.NaN })).toBe('invalidCommand');
    expect(code({ moveId: 'ship-it', target: 1.5 })).toBe('invalidCommand');
    expect(code({ moveId: 'ship-it', target: -1 })).toBe('invalidCommand');
    expect(code({ moveId: 'ship-it', target: 12 })).toBe('invalidCommand');
    expect(code({ moveId: 'no-such-move', target: 8 })).toBe('invalidCommand');
    expect(code({ moveId: 'ship-it', target: 8 })).toBeNull();
  });
});
