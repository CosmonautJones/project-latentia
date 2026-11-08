import { describe, expect, it } from 'vitest';
import { replay } from '../../src/battle/replay.js';
import { createBattle, type BattleSetup } from '../../src/battle/setup.js';
import { simulate, type BattleResult } from '../../src/battle/simulate.js';
import type { BattleEvent } from '../../src/events/types.js';
import { seedFor, setup } from '../golden/builders.js';
import { bootcampGrad } from './fixtures.js';
import { BLITZR_TEAM } from './slice.js';

// Headless Mode with bench auto-fill finishes the battle (spec §5 "Sides and roster"; plan B6). The player's starter is
// a Lv2 Blitzr — Bootcamp Grad's Autopilot aims at the weakest foe, so it is KO'd first — leading a Tokenibble and a
// Hallucinat with a Nullbeetle on the bench, all acting from decks. Once the starter falls, the side is headless: its
// orchestrator's entries are skipped, its subagents keep acting from their decks, and each KO'd subagent's slot is
// auto-filled from the bench, until the battle ends by knockout or at the cap.

const SETUP: BattleSetup = (() => {
  const team = BLITZR_TEAM(5);
  return setup({ ...team, orchestrator: { ...team.orchestrator, level: 2 } }, bootcampGrad());
})();
const SEEDS = Array.from({ length: 30 }, (_, i) => seedFor(`scenario:headless:${i}`));
const A = 0; // side a in events
const ORCH = 0;

type Run = { seed: string; result: BattleResult; headlessAt: number };

const runs: Run[] = SEEDS.map((seed) => {
  const result = simulate(SETUP, seed, { kind: 'autopilot' });
  return { seed, result, headlessAt: result.events.findIndex((e) => e.type === 'HeadlessMode' && e.side === A) };
});

/** Side a's canonical indices: the orchestrator, then its active subagents and bench. */
const SIDE_A = new Set(createBattle(SETUP, SEEDS[0] as string).creatures.filter((c) => c.side === 'a').map((c) => c.index));
const after = (run: Run): BattleEvent[] => run.result.events.slice(run.headlessAt + 1);

describe('Headless Mode with bench auto-fill', () => {
  it('every battle goes headless on side a once, and still ends with exactly one BattleEnd (knockout or cap)', () => {
    for (const run of runs) {
      expect(run.headlessAt).toBeGreaterThanOrEqual(0);
      const events = run.result.events;
      expect(events.filter((e) => e.type === 'HeadlessMode' && e.side === A)).toHaveLength(1);
      expect(events.filter((e) => e.type === 'BattleEnd')).toHaveLength(1);
      expect(events.at(-1)?.type).toBe('BattleEnd');
      const r = replay(run.result.log);
      if ('error' in r) throw new Error(`${run.seed}: replay failed (${r.error.code})`);
      expect(r.hash).toBe(run.result.hash);
    }
  });

  it("after Headless Mode the orchestrator's entries are skipped while its subagents keep acting from their decks", () => {
    for (const run of runs) {
      const rest = after(run);
      const mine = rest.filter((e) => e.type === 'ActionStarted' && e.actor === ORCH).length;
      expect(rest.filter((e) => e.type === 'ActionSkipped' && e.actor === ORCH && e.reason === 'headless')).toHaveLength(mine);
      expect(rest.some((e) => e.type === 'MoveUsed' && e.actor === ORCH)).toBe(false);
    }
    expect(runs.every((run) => after(run).some((e) => e.type === 'CardTrace' && e.actor !== ORCH && SIDE_A.has(e.actor)))).toBe(true);
  });

  it('a KO\'d subagent of the headless side is replaced from the bench, and the newcomer acts', () => {
    const filled = runs.filter((run) => after(run).some((e) => e.type === 'Swapped' && e.side === A));
    expect(filled.length).toBeGreaterThanOrEqual(20);
    const acted = filled.filter((run) => {
      const rest = after(run);
      const at = rest.findIndex((e) => e.type === 'Swapped' && e.side === A);
      const swap = rest[at];
      return swap?.type === 'Swapped' && rest.slice(at).some((e) => e.type === 'MoveUsed' && e.actor === swap.inIndex);
    });
    expect(acted.length).toBeGreaterThan(0);
  });

  it('a headless side can still win', () => {
    expect(runs.some((run) => run.result.winner === 'a')).toBe(true);
  });
});
