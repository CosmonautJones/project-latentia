import { describe, expect, it } from 'vitest';
import { holds } from '../../src/cards/conditions.js';
import { TARGET_SELECTORS, type TargetSelector } from '../../src/cards/model.js';
import { resolveTarget } from '../../src/cards/targets.js';
import { viewFor } from '../../src/battle/view.js';
import { effectiveStat } from '../../src/math/stats.js';
import { at, battle, faint, word } from './helpers.js';

// Canonical indices (helpers.battle): 0 a-orch sagelet, 1 a-act1 blitzr, 2 a-act2 forkling, 3-5 a bench,
// 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling, 9-11 b bench.

const RS = { r1: word(1, 2), r2: word(3, 4) };
const indices = (cs: readonly { index: number }[]) => cs.map((c) => c.index);

describe('viewFor', () => {
  it('projects the actor, its orchestrator, its living on-field allies and foes in canonical order', () => {
    const s = battle();
    const v = viewFor(s, 1, RS, s.round);
    expect(v.self.index).toBe(1);
    expect(v.orchestrator?.index).toBe(0);
    expect(indices(v.allies)).toEqual([0, 2]);
    expect(indices(v.foes)).toEqual([6, 7, 8]);
    expect(v.roundStart).toEqual(RS);
    expect(v.round).toBe(s.round);
    expect(v.self).toMatchObject({ isOrchestrator: false, hp: at(s, 1).hp, maxHp: at(s, 1).maxHp, types: ['speed'], contextWindow: 12, contextUsed: 0 });
  });

  it('never includes KO’d or benched creatures; a KO’d orchestrator is null', () => {
    const s = battle();
    faint(at(s, 7));
    faint(at(s, 0));
    const v = viewFor(s, 1, RS, s.round);
    expect(indices(v.foes)).toEqual([6, 8]);
    expect(v.orchestrator).toBeNull();
    expect(indices(v.allies)).toEqual([2]);
    expect(indices(viewFor(s, 2, RS, s.round).allies)).toEqual([1]);
  });

  it('takes the round being planned (required, Ruling 85) and the draws as given', () => {
    const s = battle();
    expect(viewFor(s, 1, null, 4)).toMatchObject({ round: 4, roundStart: null });
  });

  it('reads statuses (Drift as a status while it has stacks), stages, effective Compute, context fill and Junk held', () => {
    const s = battle();
    const c = at(s, 7);
    c.statuses.push({ id: 'glazed', remaining: 2, source: 1 });
    c.context.drift = 2;
    c.stages.compute = 2;
    c.context.tokens.push({ kind: 'junk', seq: 0 }, { kind: 'cost', seq: 1 });
    const foe = viewFor(s, 1, RS, s.round).foes.find((f) => f.index === 7);
    expect(foe).toMatchObject({ statuses: ['glazed', 'drift'], stages: { compute: 2 }, compute: effectiveStat(c.stats.compute, 2), contextUsed: 2, junk: 1 });
  });

  it('marks a creature charging a telegraphed move (Deliberate) as telegraphing, but not Deep Research', () => {
    const s = battle();
    at(s, 7).charging = { moveId: 'deliberate', target: 1, remaining: 1, powerDelta: 0, hitPower: -30 };
    at(s, 8).charging = { moveId: 'deep-research', target: 1, remaining: 1, powerDelta: 0, hitPower: 0 };
    const v = viewFor(s, 1, RS, s.round);
    expect(v.foes.map((f) => f.telegraphing)).toEqual([false, true, false]);
  });

  it('reads the last resolved move, the last round each move was used, and live fields held', () => {
    const s = battle();
    at(s, 1).moveHistory.push({ round: 1, moveId: 'ship-it', target: 7, damaged: [7] }, { round: 2, moveId: 'compact', target: 1, damaged: [] }, { round: 3, moveId: 'ship-it', target: 8, damaged: [8] });
    at(s, 7).moveHistory.push({ round: 2, moveId: 'ship-it', target: 1, damaged: [1] });
    s.fields.push({ effect: { kind: 'accuracyStages', delta: 1 }, source: 0, target: 1, remaining: 2 });
    const v = viewFor(s, 1, RS, s.round);
    expect(v.selfLastUsed).toEqual([
      { moveId: 'ship-it', round: 3 },
      { moveId: 'compact', round: 2 },
    ]);
    expect(v.self.lastMove).toBe('ship-it');
    expect(v.self.fields).toEqual(['accuracyStages']);
    expect(v.foes.find((f) => f.index === 7)?.lastMove).toBe('ship-it');
    expect(v.foes.find((f) => f.index === 8)?.lastMove).toBeNull();
  });

  it('orchestratorTarget is the allied orchestrator’s last resolved target only while it is a living on-field foe (Ruling 83)', () => {
    const s = battle();
    expect(viewFor(s, 1, RS, s.round).orchestratorTarget).toBeNull();
    at(s, 0).moveHistory.push({ round: 1, moveId: 'chain-of-thought', target: 8, damaged: [8] });
    expect(viewFor(s, 1, RS, s.round).orchestratorTarget).toBe(8);
    faint(at(s, 8));
    expect(viewFor(s, 1, RS, s.round).orchestratorTarget).toBeNull();
    at(s, 0).moveHistory.push({ round: 2, moveId: 'happy-to-help', target: 2, damaged: [] }); // an ally: not a foe
    expect(viewFor(s, 1, RS, s.round).orchestratorTarget).toBeNull();
    at(s, 0).moveHistory.push({ round: 3, moveId: 'chain-of-thought', target: 9, damaged: [] }); // b's bench: off the field
    expect(viewFor(s, 1, RS, s.round).orchestratorTarget).toBeNull();
  });

  it('carries the actor’s lastMoveId (what it chose, for Overfit) and its pending cost modifiers (Ruling 84)', () => {
    const s = battle();
    const c = at(s, 1);
    expect(viewFor(s, 1, RS, s.round)).toMatchObject({ lastMoveId: null, pendingCost: [] });
    c.lastMoveId = 'episodic-replay';
    c.moveHistory.push({ round: 1, moveId: 'ship-it', target: 7, damaged: [7] });
    c.nextActionMods.push({ kind: 'priority', delta: 1 }, { kind: 'costSet', cells: 0 }, { kind: 'costAdd', cells: 2 });
    const v = viewFor(s, 1, RS, s.round);
    expect(v).toMatchObject({ lastMoveId: 'episodic-replay', pendingCost: [{ kind: 'costSet', cells: 0 }, { kind: 'costAdd', cells: 2 }] });
    expect(v.self.lastMove).toBe('ship-it');
    (v.pendingCost[0] as { cells: number }).cells = 5;
    expect(c.nextActionMods[1]).toEqual({ kind: 'costSet', cells: 0 });
  });

  it('is plain data that shares nothing with the state', () => {
    const s = battle();
    at(s, 7).statuses.push({ id: 'glazed', remaining: 2, source: 1 });
    const v = viewFor(s, 1, RS, s.round);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    (v.foes[1]?.statuses as string[]).push('drift');
    (v.foes[1]?.stages as Record<string, number>).compute = 3;
    expect(at(s, 7).statuses).toHaveLength(1);
    expect(at(s, 7).stages.compute).toBe(0);
  });
});

describe('cards over a viewFor projection', () => {
  it('randomFoe reads lo(r2, living on-field foes): with b-act1 KO’d, lo = 3 picks the second of [6, 8]', () => {
    const s = battle();
    faint(at(s, 7));
    expect(resolveTarget('randomFoe', viewFor(s, 1, { r1: 0, r2: word(0, 3) }, s.round), 'ship-it')).toBe(8);
    expect(resolveTarget('randomFoe', viewFor(s, 1, { r1: 0, r2: word(0, 4) }, s.round), 'ship-it')).toBe(6);
  });

  it('a KO’d or benched creature is never a target, whatever the selector', () => {
    const s = battle();
    faint(at(s, 7));
    faint(at(s, 2));
    at(s, 0).moveHistory.push({ round: 1, moveId: 'chain-of-thought', target: 7, damaged: [] });
    at(s, 7).hp = 0;
    for (const r2 of [0, 1, 2, 3]) {
      const v = viewFor(s, 1, { r1: 0, r2 }, s.round);
      for (const sel of TARGET_SELECTORS as readonly TargetSelector[]) {
        const t = resolveTarget(sel, v, 'chain-of-thought');
        if (t !== null) expect(at(s, t).fainted || at(s, t).slot === 'bench').toBe(false);
      }
    }
  });

  it('a foe condition sees only living on-field foes', () => {
    const s = battle();
    at(s, 9).hp = 1; // benched: invisible
    expect(holds({ id: 'x', subject: 'foe', condition: { category: 'hp', op: 'below', pct: 25 }, move: 'ship-it', target: 'lowestHpFoe' }, viewFor(s, 1, RS, s.round))).toBe(false);
    at(s, 8).hp = 1;
    expect(holds({ id: 'x', subject: 'foe', condition: { category: 'hp', op: 'below', pct: 25 }, move: 'ship-it', target: 'lowestHpFoe' }, viewFor(s, 1, RS, s.round))).toBe(true);
  });
});
