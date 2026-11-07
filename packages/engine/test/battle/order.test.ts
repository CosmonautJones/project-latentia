import { describe, expect, it } from 'vitest';
import { EngineInvariantError } from '../../src/math/bp.js';
import { effectiveStat } from '../../src/math/stats.js';
import { defaultIntent, planEntries, sortActions, type ActionEntry } from '../../src/battle/order.js';
import type { OrchestratorAction } from '../../src/battle/log.js';
import type { BattleState, Card } from '../../src/battle/state.js';
import { at, battle, faint } from './helpers.js';

const entry = (actor: number, priority: number, latency: number, tieBreak: number): ActionEntry => ({
  actor,
  priority,
  latency,
  tieBreak,
  moveId: 'ship-it',
  target: 0,
});

/** planEntries reads the round-start draws; give every creature a distinct tie-break. */
function withRoundStart(state: BattleState): BattleState {
  state.creatures.forEach((c, i) => {
    c.roundStart = { r1: 0xabcd0000 + i, r2: 7 };
  });
  return state;
}

describe('sortActions', () => {
  it('orders by priority bracket descending first', () => {
    const sorted = sortActions([entry(1, -3, 99, 9), entry(2, 4, 1, 1), entry(3, 0, 50, 5)]);
    expect(sorted.map((e) => e.actor)).toEqual([2, 3, 1]);
  });

  it('breaks priority ties by effective latency descending', () => {
    const sorted = sortActions([entry(1, 0, 10, 9), entry(2, 0, 30, 1), entry(3, 0, 20, 5)]);
    expect(sorted.map((e) => e.actor)).toEqual([2, 3, 1]);
  });

  it('breaks latency ties by the round-start tie-break descending', () => {
    const sorted = sortActions([entry(1, 0, 10, 100), entry(2, 0, 10, 65535), entry(3, 0, 10, 0)]);
    expect(sorted.map((e) => e.actor)).toEqual([2, 1, 3]);
  });

  it('falls back to canonical index ascending when everything else is equal', () => {
    const sorted = sortActions([entry(9, 1, 10, 7), entry(0, 1, 10, 7), entry(4, 1, 10, 7), entry(2, 1, 10, 7)]);
    expect(sorted.map((e) => e.actor)).toEqual([0, 2, 4, 9]);
  });

  it('applies the keys lexicographically in a mixed list', () => {
    const sorted = sortActions([
      entry(5, 0, 10, 3),
      entry(1, 0, 10, 3),
      entry(4, 0, 12, 0),
      entry(3, 3, 1, 0),
      entry(2, 0, 10, 4),
    ]);
    expect(sorted.map((e) => e.actor)).toEqual([3, 4, 2, 1, 5]);
  });

  it('returns a new array and leaves its input unchanged', () => {
    const input = [entry(2, 0, 1, 1), entry(1, 0, 1, 1)];
    const sorted = sortActions(input);
    expect(input.map((e) => e.actor)).toEqual([2, 1]);
    expect(sorted).not.toBe(input);
  });

  it('throws EngineInvariantError when one creature has two entries (no total order)', () => {
    expect(() => sortActions([entry(1, 0, 1, 1), entry(1, 0, 1, 1)])).toThrow(EngineInvariantError);
  });
});

describe('defaultIntent', () => {
  it('uses the first non-universal move against the lowest-HP living foe on the field', () => {
    const s = battle();
    at(s, 8).hp = 5;
    at(s, 9).hp = 1; // bench: never targeted while a foe is on the field
    expect(defaultIntent(s, 1)).toEqual({ moveId: 'ship-it', target: 8 });
    expect(defaultIntent(s, 7)).toEqual({ moveId: 'ship-it', target: 1 });
  });

  it('breaks HP ties by lowest canonical index and skips fainted foes', () => {
    const s = battle();
    at(s, 6).hp = 20;
    at(s, 7).hp = 20;
    expect(defaultIntent(s, 2)).toEqual({ moveId: 'hard-fork', target: 6 });
    faint(at(s, 6));
    expect(defaultIntent(s, 2)).toEqual({ moveId: 'hard-fork', target: 7 });
  });

  it('falls back to the foe orchestrator when no foe on the field is alive, even with a living bench', () => {
    const s = battle();
    faint(at(s, 6));
    faint(at(s, 7));
    faint(at(s, 8));
    expect(defaultIntent(s, 1).target).toBe(6);
  });

  it('ignores a foe in a removed slot', () => {
    const s = battle();
    at(s, 7).hp = 1;
    const slot = s.sides.b.slots[0];
    if (slot === undefined) throw new Error('slot');
    slot.pieceId = 'slot1';
    at(s, 6).context.removedSlots.push('slot1');
    expect(defaultIntent(s, 1).target).not.toBe(7);
  });

  it('ally-kind move: aims at the lowest-HP on-field ally, ties to lowest index, possibly itself', () => {
    const s = battle();
    at(s, 2).moves = ['community-patch', 'compact'];
    at(s, 3).hp = 1; // bench ally: off the field
    expect(defaultIntent(s, 2)).toEqual({ moveId: 'community-patch', target: 1 }); // 20 HP vs 21/21
    at(s, 1).hp = 21;
    expect(defaultIntent(s, 2).target).toBe(0); // three-way tie at 21 → lowest index
    at(s, 2).hp = 4;
    expect(defaultIntent(s, 2).target).toBe(2); // itself
    faint(at(s, 7)); // foes are irrelevant to an ally move
    expect(defaultIntent(s, 2).target).toBe(2);
  });

  it('self-kind move: aims at the actor', () => {
    const s = battle();
    at(s, 1).moves = ['low-latency', 'ship-it'];
    expect(defaultIntent(s, 1)).toEqual({ moveId: 'low-latency', target: 1 });
  });

  it('none-kind move: aims at the actor', () => {
    const s = battle();
    at(s, 8).moves = ['ground-truth'];
    expect(defaultIntent(s, 8)).toEqual({ moveId: 'ground-truth', target: 8 });
  });

  it('foe-kind moves of every flavour aim at the lowest-HP on-field foe', () => {
    const s = battle();
    at(s, 6).hp = 3;
    for (const m of ['ship-it', 'off-by-one', 'cosine-sniff']) {
      at(s, 1).moves = [m];
      expect(defaultIntent(s, 1)).toEqual({ moveId: m, target: 6 });
    }
  });

  it('skips universal moves even when they are listed first', () => {
    const s = battle();
    at(s, 1).moves = ['compact', 'guardrail', 'token-burst', 'clear'];
    expect(defaultIntent(s, 1).moveId).toBe('token-burst');
  });
});

describe('planEntries', () => {
  it('gives the orchestrator and each living active subagent one entry; bench creatures get none', () => {
    const s = withRoundStart(battle());
    expect(planEntries(s, {}).map((e) => e.actor).sort((x, y) => x - y)).toEqual([0, 1, 2, 6, 7, 8]);
  });

  it('keeps an entry for a fainted orchestrator but none for a fainted subagent', () => {
    const s = withRoundStart(battle());
    faint(at(s, 0));
    faint(at(s, 2));
    expect(planEntries(s, {}).map((e) => e.actor).sort((x, y) => x - y)).toEqual([0, 1, 6, 7, 8]);
  });

  it('gives no entry to a subagent whose slot was removed', () => {
    const s = withRoundStart(battle());
    const slot = s.sides.b.slots[1];
    if (slot === undefined) throw new Error('slot');
    slot.pieceId = 'slot2';
    at(s, 6).context.removedSlots.push('slot2');
    expect(planEntries(s, {}).map((e) => e.actor).sort((x, y) => x - y)).toEqual([0, 1, 2, 6, 7]);
  });

  it('fills priority from the move, effective latency from the stat and stage, tie-break from R1 low 16 bits', () => {
    const s = withRoundStart(battle());
    at(s, 1).stages.latency = 2;
    const e = planEntries(s, {}).find((x) => x.actor === 1);
    expect(e).toEqual({
      actor: 1,
      priority: 0,
      latency: effectiveStat(at(s, 1).stats.latency, 2),
      tieBreak: 0x0001,
      moveId: 'ship-it',
      target: 7,
    });
    expect(e?.latency).toBe(19); // floor(13 * 15000 / 10000)
  });

  it("takes the orchestrator's move and target from its SideCommand", () => {
    const s = withRoundStart(battle());
    const entries = planEntries(s, { a: { temperature: 1, action: { kind: 'move', moveId: 'guardrail', target: 0 } } });
    expect(entries.find((x) => x.actor === 0)).toMatchObject({ moveId: 'guardrail', target: 0, priority: 4 });
  });

  it('normalizes the target of a self or none move to the actor', () => {
    const s = withRoundStart(battle());
    const entries = planEntries(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'step-back-prompt', target: 99 } } });
    expect(entries.find((x) => x.actor === 0)).toMatchObject({ moveId: 'step-back-prompt', target: 0 });
  });

  it("carries a move command's injection choice", () => {
    const s = withRoundStart(battle());
    const injection = { moveId: 'ship-it', target: 2 };
    const entries = planEntries(s, { a: { temperature: 2, action: { kind: 'move', moveId: 'chain-of-thought', target: 7, injection } } });
    expect(entries.find((x) => x.actor === 0)).toMatchObject({ moveId: 'chain-of-thought', target: 7, injection });
  });

  it('carries the whole lever action: none at 0, Directive and Policy Update at 0, Swap at +3', () => {
    const card = { id: 'c1' } as unknown as Card;
    const cases: [OrchestratorAction, number][] = [
      [{ kind: 'none' }, 0],
      [{ kind: 'directive', subagent: 1, moveId: 'token-burst', target: 8 }, 0],
      [{ kind: 'policyUpdate', card }, 0],
      [{ kind: 'swap', out: 2, in: 4 }, 3],
    ];
    for (const [action, priority] of cases) {
      const s = withRoundStart(battle());
      const e = planEntries(s, { a: { temperature: 2, action } }).find((x) => x.actor === 0);
      expect(e?.lever).toEqual(action);
      expect(e?.priority).toBe(priority);
    }
  });

  it("ignores a headless (KO'd) orchestrator's command; its entry still exists", () => {
    const s = withRoundStart(battle());
    faint(at(s, 0));
    const e = planEntries(s, { a: { temperature: 2, action: { kind: 'swap', out: 1, in: 3 } } }).find((x) => x.actor === 0);
    expect(e).toBeDefined();
    expect(e?.lever).toBeUndefined();
  });
});
