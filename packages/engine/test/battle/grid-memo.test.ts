import { describe, expect, it, vi } from 'vitest';
import type { RoundCommand } from '../../src/battle/log.js';
import type { BattleSetup, SideSetup } from '../../src/battle/setup.js';
import type { BattleState } from '../../src/battle/state.js';
import { validateSetup } from '../../src/battle/setup.js';
import { simulate, type BattleResult } from '../../src/battle/simulate.js';
import type { Deck } from '../../src/cards/model.js';
import type { PlacedPiece } from '../../src/grid/model.js';
import type { SeedHex } from '../../src/rng/seed.js';
import { mon, seedFor, setup } from '../golden/builders.js';
import { SCENARIOS } from '../golden/scenarios.js';
import { scriptedSource } from '../golden/script.js';
import { ALWAYS, card } from '../scenarios/fixtures.js';

// The grid memo (src/grid/derived.ts, C3.5) must never change a battle: every battle here is played twice, with the
// memo on and with every lookup recomputed from the grid (the code it replaced), and must give the same events.
// The deck-driven gridded fixture compacts a Skill (Tool steps, Summary) and then a Subagent Slot (removed slot,
// force-bench, active cards) mid-fight, which the test checks happens.

const memo = vi.hoisted(() => ({ on: true }));

vi.mock('../../src/grid/derived.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/grid/derived.js')>();
  const adj = await import('../../src/grid/adjacency.js');
  return {
    gridActiveCards: (...a: Parameters<typeof real.gridActiveCards>) => (memo.on ? real.gridActiveCards(...a) : adj.activeCardCount(...a)),
    gridToolSteps: (...a: Parameters<typeof real.gridToolSteps>) => (memo.on ? real.gridToolSteps(...a) : adj.toolStepsFor(...a)),
    gridMovePiece: (...a: Parameters<typeof real.gridMovePiece>) =>
      memo.on ? real.gridMovePiece(...a) : (a[0].pieces.find((p) => (p.kind === 'skill' || p.kind === 'graft') && p.moveId === a[1]) ?? null),
  };
});

const both = (run: () => BattleResult): { on: BattleResult; off: BattleResult } => {
  memo.on = true;
  const on = run();
  memo.on = false;
  try {
    return { on, off: run() };
  } finally {
    memo.on = true;
  }
};

const at = (id: string, kind: PlacedPiece['kind'], x: number, y: number, extra: Partial<PlacedPiece> = {}): PlacedPiece => {
  const shapes: Record<PlacedPiece['kind'], [number, number][]> = {
    systemPrompt: [[0, 0], [1, 0], [2, 0]],
    skill: [[0, 0], [1, 0]],
    graft: [[0, 0], [1, 0]],
    tool: [[0, 0]],
    exampleCard: [[0, 0]],
    cache: [[0, 0]],
    subagentSlot: [[0, 0], [1, 0], [0, 1], [1, 1]],
  };
  return { id, kind, shape: shapes[kind], anchor: [x, y], rotation: 0, ...extra };
};

/**
 * A 4x4 Lv3 grid with four free cells: System Prompt along the top with a Tool at its end, a Skill holding `skill`
 * under the Tool (one Tool step), and the slot for `sub` with two Example Cards below it (two active cards).
 */
function griddedSide(tag: 'a' | 'b', orch: string, skill: string, autopilot: Deck, sub: string, subDeck: Deck): SideSetup {
  return {
    orchestrator: { ...mon(`${tag}-orch`, orch, 3), moves: [] },
    active: [{ ...mon(`${tag}-sub`, sub, 6), deck: subDeck, generalization: 90 }],
    bench: [mon(`${tag}-bench`, 'cobolt', 6)],
    grid: {
      width: 4,
      height: 4,
      pieces: [
        at('sp', 'systemPrompt', 0, 0),
        at('tool', 'tool', 3, 0),
        at('skill', 'skill', 2, 1, { moveId: skill }),
        at('slot', 'subagentSlot', 0, 1, { subagentId: `${tag}-sub` }),
        at('ex1', 'exampleCard', 0, 3),
        at('ex2', 'exampleCard', 1, 3),
      ],
    },
    autopilot: { deck: autopilot, temperature: 2 },
    opponentId: tag === 'a' ? 'trainer-b' : 'trainer-a',
  };
}

const COIN = { category: 'coin' } as const;
// Three cards for two active slots: the third is traced notActive while the slot lives.
const SUB_DECK: Deck = {
  cards: [card('hit', 'self', COIN, 'ship-it', 'lowestHpFoe'), card('fast', 'self', ALWAYS, 'token-burst', 'randomFoe'), card('spare', 'self', ALWAYS, 'ship-it', 'highestAtkFoe')],
  default: card('def', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
};

/** Vibrat fills its window with Accept All (cost 3 plus a forced Junk); Spaghettopus' Memory Leak adds Junk each round. */
const FIGHT: BattleSetup = setup(
  griddedSide('a', 'vibrat', 'segfault', { cards: [card('seg', 'self', COIN, 'segfault', 'lowestHpFoe')], default: card('all', 'self', ALWAYS, 'accept-all', 'lowestHpFoe') }, 'blitzr', SUB_DECK),
  griddedSide('b', 'spaghettopus', 'memory-leak', { cards: [card('leak', 'self', COIN, 'memory-leak', 'orchestrator')], default: card('tangle', 'self', ALWAYS, 'tangle', 'lowestHpFoe') }, 'blitzr', SUB_DECK),
);

describe('grid memo (C3.5): same events with it on and off', () => {
  it('the fixture is a legal setup', () => {
    expect(validateSetup(FIGHT).errors).toEqual([]);
  });

  it('a deck-driven gridded fight whose grid compacts a Skill and then a Subagent Slot mid-fight', () => {
    const compacted = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { on, off } = both(() => simulate(FIGHT, seedFor(`grid-memo:${i}`), { kind: 'autopilot' }));
      expect(on.events).toEqual(off.events);
      expect(on.hash).toBe(off.hash);
      for (const e of on.events) if (e.type === 'PieceCompacted' && e.round > 1) compacted.add(e.pieceId);
    }
    expect([...compacted].sort()).toEqual(['skill', 'slot']);
  });

  it('every golden scenario', () => {
    for (const s of SCENARIOS) {
      const { on, off } = both(() => simulate(s.setup, s.seed, scriptedSource(s.scripts)));
      expect(on.hash, s.name).toBe(off.hash);
    }
  });
});

/** Plays `setup` with `source`'s commands and returns the result and the final battle state (simulate advances one state in place). */
function finalState(setup: BattleSetup, seed: SeedHex, next: (s: BattleState) => RoundCommand): { result: BattleResult; state: BattleState } {
  let state: BattleState | null = null;
  const result = simulate(setup, seed, {
    kind: 'scripted',
    next: (s) => {
      state = s;
      return next(s);
    },
  });
  if (state === null) throw new Error('no round was played');
  return { result, state };
}

describe('battle grids are never edited (C3.5 m2: the memo relies on it)', () => {
  it('after every golden scenario, each side’s battle grid deep-equals its setup grid', () => {
    for (const s of SCENARIOS) {
      const source = scriptedSource(s.scripts);
      if (source.kind !== 'scripted') throw new Error('golden scripts are scripted');
      const { state } = finalState(s.setup, s.seed, source.next);
      expect(state.sides.a.grid, `${s.name} a`).toEqual(s.setup.a.grid);
      expect(state.sides.b.grid, `${s.name} b`).toEqual(s.setup.b.grid);
    }
  });

  it('after the memo fixture’s compacting fights, each side’s battle grid deep-equals its setup grid', () => {
    for (let i = 0; i < 40; i++) {
      // `{}` every round is exactly the Autopilot source (Ruling 95): the same battle, with the state in hand.
      const { result, state } = finalState(FIGHT, seedFor(`grid-memo:${i}`), () => ({}));
      expect(result.hash).toBe(simulate(FIGHT, seedFor(`grid-memo:${i}`), { kind: 'autopilot' }).hash);
      expect(state.sides.a.grid).toEqual(FIGHT.a.grid);
      expect(state.sides.b.grid).toEqual(FIGHT.b.grid);
    }
  });
});
