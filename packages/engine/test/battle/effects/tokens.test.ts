import { describe, expect, it } from 'vitest';
import { assertInvariants } from '../../../src/battle/invariants.js';
import type { RoundCommand } from '../../../src/battle/log.js';
import { submitRound } from '../../../src/battle/round.js';
import { createBattle } from '../../../src/battle/setup.js';
import type { BattleState } from '../../../src/battle/state.js';
import type { PlacedPiece } from '../../../src/grid/model.js';
import { grid, piece } from '../../grid/helpers.js';
import { at, gridlessSide, mon, SEED, withoutPassives } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

const fill = (s: BattleState, i: number, n: number) => {
  for (let k = 0; k < n; k++) at(s, i).context.tokens.push({ kind: 'cost', seq: 100 + k });
};

describe('tokens: addJunk', () => {
  it('Filibuster adds 2 Junk to the target', () => {
    const s = fresh();
    const events = run(s, 1, 'filibuster', 7);
    expect(ofType(events, 'ContextAdded').filter((e) => e.target === 7 && e.kind === 'junk')).toEqual([
      { round: 1, type: 'ContextAdded', target: 7, kind: 'junk', tokens: 1, tokensAfter: 1 },
      { round: 1, type: 'ContextAdded', target: 7, kind: 'junk', tokens: 1, tokensAfter: 2 },
    ]);
    expect(at(s, 7).context.tokens.map((t) => t.kind)).toEqual(['junk', 'junk', 'observation']);
  });

  it('a full subagent window turns each forced token into 1 Drift instead', () => {
    const s = fresh();
    fill(s, 7, at(s, 7).context.window);
    const events = run(s, 1, 'filibuster', 7);
    expect(ofType(events, 'DriftChanged')).toEqual([
      { round: 1, type: 'DriftChanged', target: 7, drift: 1 },
      { round: 1, type: 'DriftChanged', target: 7, drift: 2 },
    ]);
  });
});

describe('tokens: a compacted Subagent Slot (Ruling 25)', () => {
  const slotFirst = (): BattleState => {
    const slot = (id: string, x: number, sub: string): PlacedPiece => ({ ...piece(id, 'subagentSlot', x, 1), subagentId: sub });
    // Pieces order sp, slot1, slot2: slot1 is the lowest-index compactable piece. 12 cells, headroom 8.
    const g = grid(5, 4, [piece('sp', 'systemPrompt', 0, 0), slot('slot1', 0, 'a-act1'), slot('slot2', 2, 'a-act2'), piece('tl', 'tool', 4, 1)]);
    const orchestrator = { ...mon('a-orch', 'sagelet', 5), moves: [] };
    const s = withoutPassives(createBattle({ a: gridlessSide('a', { orchestrator, grid: g }), b: gridlessSide('b'), kind: 'trainer' }, SEED));
    s.round = 1;
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    fill(s, 0, at(s, 0).context.window);
    return s;
  };

  it('force-benches its subagent to the END of the bench (bench length 4); the slot is never refilled', () => {
    const s = slotFirst();
    const events = run(s, 7, 'filibuster', 0);
    expect(ofType(events, 'PieceCompacted')).toEqual([{ round: 1, type: 'PieceCompacted', target: 0, pieceId: 'slot1' }]);
    expect(ofType(events, 'Swapped')).toEqual([{ round: 1, type: 'Swapped', side: 0, outIndex: 1, inIndex: -1 }]);
    expect(at(s, 1)).toMatchObject({ slot: 'bench', activeSlot: null, benchOrder: 3 });
    expect([3, 4, 5].map((i) => at(s, i).benchOrder)).toEqual([0, 1, 2]);
    expect(s.sides.a.slots[0]?.occupant).toBeNull();
    assertInvariants(s);
    const next = submitRound(s, {});
    if ('error' in next) throw new Error(next.error.message);
    expect(next.state.sides.a.slots[0]?.occupant).toBeNull();
    expect(ofType(next.events, 'Swapped').filter((e) => e.side === 0)).toEqual([]);
  });
});

describe('tokens: freeOldest, compact, clear', () => {
  it('Refactor resets the user’s stages, frees its 2 oldest tokens and cures Quantized', () => {
    const s = fresh();
    fill(s, 1, 4);
    at(s, 1).stages.compute = 2;
    at(s, 1).statuses.push({ id: 'quantized', remaining: 2 });
    const events = run(s, 1, 'refactor', 1);
    expect(ofType(events, 'StageChanged')).toEqual([{ round: 1, type: 'StageChanged', target: 1, stat: 'compute', delta: -2, stageAfter: 0 }]);
    expect(ofType(events, 'ContextAdded')).toEqual([{ round: 1, type: 'ContextAdded', target: 1, kind: 'freed', tokens: -2, tokensAfter: 2 }]);
    expect(ofType(events, 'StatusCured')).toEqual([{ round: 1, type: 'StatusCured', target: 1, status: 'quantized' }]);
    expect(at(s, 1).context.tokens.map((t) => t.seq)).toEqual([102, 103]);
  });

  it('Compact pairs the six oldest and clears exactly 1 Drift', () => {
    const s = fresh();
    fill(s, 1, 7);
    at(s, 1).context.drift = 3;
    const events = run(s, 1, 'compact', 1);
    expect(ofType(events, 'Compacted')).toEqual([{ round: 1, type: 'Compacted', target: 1, tokensBefore: 7, tokensAfter: 4 }]);
    expect(ofType(events, 'DriftChanged')).toEqual([{ round: 1, type: 'DriftChanged', target: 1, drift: 2 }]);
  });

  it('/clear wipes tokens, stat stages and Drift', () => {
    const s = fresh();
    fill(s, 1, 5);
    Object.assign(at(s, 1).stages, { compute: 2, evasion: -1 });
    at(s, 1).context.drift = 4;
    const events = run(s, 1, 'clear', 1);
    expect(ofType(events, 'ContextAdded')).toEqual([{ round: 1, type: 'ContextAdded', target: 1, kind: 'cleared', tokens: -5, tokensAfter: 0 }]);
    expect(ofType(events, 'StageChanged').map((e) => [e.stat, e.stageAfter])).toEqual([
      ['compute', 0],
      ['evasion', 0],
    ]);
    expect(ofType(events, 'DriftChanged')).toEqual([{ round: 1, type: 'DriftChanged', target: 1, drift: 0 }]);
    expect(at(s, 1).context).toMatchObject({ tokens: [], drift: 0 });
    expect(at(s, 1).nextActionMods).toEqual([]); // a subagent keeps acting (Ruling 11)
  });
});

describe("/clear skips the orchestrator's next command (Ruling 11)", () => {
  it("the next command emits ActionSkipped { reason: 'cleared' } after its draws; the one after acts", () => {
    const cmd = (moveId: string, target: number): RoundCommand => ({ a: { temperature: 2, action: { kind: 'move', moveId, target } } });
    const s0 = fresh();
    s0.round = 0;
    const r1 = submitRound(s0, cmd('clear', 0));
    if ('error' in r1) throw new Error(r1.error.message);
    expect(r1.state.creatures[0]?.nextActionMods).toEqual([{ kind: 'skip', reason: 'cleared', scope: 'orchestratorCommand' }]);
    const r2 = submitRound(r1.state, cmd('happy-to-help', 7));
    if ('error' in r2) throw new Error(r2.error.message);
    const i = r2.events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 0);
    expect(r2.events[i + 1]).toEqual({ round: 2, type: 'ActionSkipped', actor: 0, reason: 'cleared' });
    expect(ofType(r2.events, 'MoveUsed').filter((e) => e.actor === 0)).toEqual([]);
    expect(r2.state.creatures[0]?.nextActionMods).toEqual([]);
    const r3 = submitRound(r2.state, cmd('happy-to-help', 7));
    if ('error' in r3) throw new Error(r3.error.message);
    expect(ofType(r3.events, 'MoveUsed').filter((e) => e.actor === 0)).toHaveLength(1);
  });
});
