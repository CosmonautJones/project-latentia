import { describe, expect, it } from 'vitest';
import { typeMultiplierBp } from '../../../src/content/types.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { planEntries } from '../../../src/battle/order.js';
import { drawRoundStart } from '../../../src/rng/draws.js';
import { submitRound } from '../../../src/battle/round.js';
import type { BattleState } from '../../../src/battle/state.js';
import { at, battle } from '../helpers.js';
import { dealt, expected, fresh, ofType, run } from './kit.js';

// 1 a-act1 blitzr charges Reasoning moves at 7 b-act1 blitzr (speed).
const REASONING_ON_SPEED = typeMultiplierBp('reasoning', ['speed']);
const SEARCH_ON_SPEED = typeMultiplierBp('search', ['speed']);

describe('charge: the charge round', () => {
  it('Deliberate telegraphs and pays its cost but rolls no accuracy; nothing else resolves yet', () => {
    const s = fresh();
    const events = run(s, 1, 'deliberate', 7, { d3lo: 99 }); // 99 would miss a 95-accuracy move
    expect(events).toEqual([
      { round: 1, type: 'MoveUsed', actor: 1, moveId: 'deliberate', target: 7 },
      { round: 1, type: 'ContextAdded', target: 1, kind: 'cost', tokens: 4, tokensAfter: 4 },
      { round: 1, type: 'Revealed', actor: 1, target: 7, what: 'telegraph' },
      { round: 1, type: 'ContextAdded', target: 7, kind: 'observation', tokens: 1, tokensAfter: 1 },
      { round: 1, type: 'ObservationGained', target: 7, observation: 'deliberate' },
    ]);
    expect(at(s, 1).charging).toEqual({ moveId: 'deliberate', target: 7, remaining: 1, powerDelta: 0, hitPower: -30 });
  });

  it('Deep Research charges without a telegraph', () => {
    const s = fresh();
    expect(ofType(run(s, 1, 'deep-research', 7), 'Revealed')).toEqual([]);
    expect(at(s, 1).charging).toMatchObject({ moveId: 'deep-research', remaining: 1 });
  });
});

describe('charge: the release', () => {
  it('resolves on the next entry whatever the entry says: no second cost, accuracy rolled, the rest of the effects applied', () => {
    const s = fresh();
    run(s, 1, 'deliberate', 7);
    s.round = 2;
    const release = run(s, 1, 'ship-it', 8);
    expect(release[0]).toEqual({ round: 2, type: 'MoveUsed', actor: 1, moveId: 'deliberate', target: 7 });
    expect(ofType(release, 'ContextAdded').filter((e) => e.target === 1)).toEqual([]);
    expect(dealt(release)).toEqual([expected(s, 1, 7, 130, { type: REASONING_ON_SPEED, roll: 10000, observation: 9000 })]);
    expect(at(s, 1).charging).toBeNull();
  });

  it('rolls accuracy on release (a miss there loses the move)', () => {
    const s = fresh();
    run(s, 1, 'deliberate', 7);
    const release = run(s, 1, 'deliberate', 7, { d3lo: 95 });
    expect(ofType(release, 'Missed')).toEqual([{ round: 1, type: 'Missed', actor: 1, target: 7 }]);
    expect(at(s, 1).charging).toBeNull();
  });

  it('a hit while charging costs Deliberate 30 power (once); Deep Research loses nothing', () => {
    const s = fresh();
    run(s, 1, 'deliberate', 7);
    run(s, 8, 'hard-fork', 1);
    run(s, 8, 'hard-fork', 1);
    expect(at(s, 1).charging?.powerDelta).toBe(-30);
    expect(dealt(run(s, 1, 'deliberate', 7))).toEqual([expected(s, 1, 7, 100, { type: REASONING_ON_SPEED, roll: 10000, observation: 9000 })]);
    const t = fresh();
    run(t, 1, 'deep-research', 7);
    run(t, 8, 'hard-fork', 1);
    expect(dealt(run(t, 1, 'deep-research', 7))).toEqual([expected(t, 1, 7, 140, { type: SEARCH_ON_SPEED, roll: 10000, observation: 9000 })]);
  });

  it("a longer charge skips its user's entries with ActionSkipped { reason: 'charging' } until the release", () => {
    const s = fresh();
    run(s, 1, 'deliberate', 7);
    const charge = at(s, 1).charging;
    if (charge === null) throw new Error('not charging');
    charge.remaining = 2;
    expect(run(s, 1, 'ship-it', 7)).toEqual([{ round: 1, type: 'ActionSkipped', actor: 1, reason: 'charging' }]);
    expect(at(s, 1).charging?.remaining).toBe(1);
    expect(ofType(run(s, 1, 'ship-it', 7), 'MoveUsed')).toEqual([{ round: 1, type: 'MoveUsed', actor: 1, moveId: 'deliberate', target: 7 }]);
  });

  it("a charging subagent's planned entry is its charged move at its stored target and priority", () => {
    const s = fresh();
    for (const c of s.creatures) c.roundStart = drawRoundStart(s.rng);
    run(s, 1, 'deliberate', 7);
    expect(planEntries(s, {}).find((e) => e.actor === 1)).toMatchObject({ moveId: 'deliberate', target: 7, priority: -1 });
  });

  it('a KO while charging drops the charge', () => {
    const s = fresh();
    run(s, 1, 'deliberate', 7);
    at(s, 1).hp = 1;
    run(s, 8, 'hard-fork', 1);
    expect(at(s, 1)).toMatchObject({ fainted: true, charging: null });
  });
});

describe('charge through submitRound', () => {
  const deliberating = (): BattleState => {
    const s = battle();
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    at(s, 0).moves.push('deliberate');
    const r = submitRound(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'deliberate', target: 7 } } });
    if ('error' in r) throw new Error(r.error.message);
    expect(r.state.creatures[0]?.charging).toMatchObject({ moveId: 'deliberate', target: 7 });
    return r.state;
  };

  it("rejects a charging orchestrator's next command with actorSkipped, leaving the state untouched", () => {
    const s = deliberating();
    const before = structuredClone(s);
    const cmds: RoundCommand[] = [
      { a: { temperature: 2, action: { kind: 'move', moveId: 'happy-to-help', target: 7 } } },
      { a: { temperature: 2, action: { kind: 'swap', out: 1, in: 3 } } },
    ];
    for (const cmd of cmds) {
      const r = submitRound(s, cmd);
      expect('error' in r && r.error.code).toBe('actorSkipped');
    }
    expect(s).toEqual(before);
  });

  it('releases automatically on its next entry under a none command (or none at all)', () => {
    for (const cmd of [{ a: { temperature: 2, action: { kind: 'none' } } }, {}] as RoundCommand[]) {
      const r = submitRound(deliberating(), cmd);
      if ('error' in r) throw new Error(r.error.message);
      const used = ofType(r.events, 'MoveUsed').filter((e) => e.actor === 0);
      expect(used).toEqual([{ round: 2, type: 'MoveUsed', actor: 0, moveId: 'deliberate', target: 7 }]);
      expect(r.state.creatures[0]?.charging).toBeNull();
    }
  });
});
