import { describe, expect, it } from 'vitest';
import { measureGraftHint, measureLoop, naiveCommand, pooledWinRate } from '../../scripts/loop-balance.js';
import { GRAFT_HINTS } from '../../src/content/journey-text.js';
import { STARTERS } from '../../src/flow/flow.js';
import { trainerBattle } from '../../src/content/battles.js';
import { createBattle } from '@latentia/engine';

// The committed measurement is `pnpm measure-loop` (200 seeds per starter; numbers in content/trainers.ts). This is the
// same measurement on fewer seeds, with looser bars, so it guards the tuning without being flaky.
describe('the core loop: lose with a bad card, teach a better one, win the rematch', () => {
  const rows = measureLoop(40);
  const rate = (path: string) => {
    const row = rows.find((r) => r.path === path);
    if (!row) throw new Error(`no loop-balance row for path "${path}" (have: ${rows.map((r) => r.path).join(', ')})`);
    return pooledWinRate(row);
  };

  it('the bad preset mostly loses and the good preset mostly wins', () => {
    expect(1 - rate('bad')).toBeGreaterThanOrEqual(0.55);
    expect(rate('good')).toBeGreaterThanOrEqual(0.8);
  });

  it('the situational preset lands in between', () => {
    expect(rate('situational')).toBeGreaterThan(rate('bad'));
    expect(rate('situational')).toBeLessThan(rate('good'));
  });

  it('the graft path is winnable by naive play at least half the time', () => {
    expect(rate('graft')).toBeGreaterThanOrEqual(0.5);
  });

  it("the naive player picks its orchestrator's strongest affordable damaging move at T2", () => {
    const def = trainerBattle('blitzr', 'spinUp', 'tutorial.b', 0);
    const cmd = naiveCommand(createBattle(def.setup, def.seed));
    // Blitzr's moves: Ship It 65, Token Burst 40, Low Latency (no power), Distilled Strike 75.
    expect(cmd.a).toEqual({ temperature: 2, action: { kind: 'move', moveId: 'distilled-strike', target: 2 } });
  });
});

// The graft path's loss hint (debrief): it names the grafted Token Nibble and says what to do with it for this starter.
// A scripted player that follows the hint must beat the naive player, who never picks Token Nibble.
describe('the graft hint: following it wins more than naive play, for every starter', () => {
  const rows = measureGraftHint(40);

  it.each(STARTERS)('%s: the hint names the grafted Token Nibble', (starter) => {
    expect(GRAFT_HINTS[starter]).toMatch(/grafted Token Nibble/);
  });

  it.each(STARTERS)('%s: the hinted player wins at least as often as the naive one', (starter) => {
    const r = rows[starter];
    expect(r.hinted).toBeGreaterThanOrEqual(r.naive);
  });

  it("Blitzr's graft path, the weak spot (naive about 30%), gains at least 10 points (4 more wins in 40)", () => {
    expect(rows.blitzr.hinted - rows.blitzr.naive).toBeGreaterThanOrEqual(4);
  });
});
