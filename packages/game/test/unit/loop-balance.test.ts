import { describe, expect, it } from 'vitest';
import { measureGraftHint, measureLoop, measureRival, naiveCommand, pooledWinRate, telegraphCommand } from '../../scripts/loop-balance.js';
import { GRAFT_HINTS } from '../../src/content/journey-text.js';
import { STARTERS } from '../../src/flow/flow.js';
import { trainerBattle } from '../../src/content/battles.js';
import { createBattle, getIntents, previewDamage, submitRound } from '@latentia/engine';
import { rivalBattle } from '../../src/content/battles.js';

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

// Plan v0.1 Q2: the engine only gained a read-only helper (0.4.2), so the naive player's fights must not move. These are
// the 40-seed wins measured on engine 0.4.1 before Q2b, pinned exactly.
describe('the naive numbers are unchanged by Q2b (engine 0.4.2 adds only previewDamage)', () => {
  it('Bootcamp Grad, 40 seeds per starter: the same wins per preset and starter as on engine 0.4.1', () => {
    expect(measureLoop(40).map((r) => [r.path, r.wins])).toEqual([
      ['bad', { sagelet: 17, blitzr: 0, forkling: 0 }],
      ['situational', { sagelet: 40, blitzr: 18, forkling: 40 }],
      ['good', { sagelet: 40, blitzr: 38, forkling: 40 }],
      ['graft', { sagelet: 34, blitzr: 9, forkling: 35 }],
    ]);
  });
  it('Kip, 40 seeds per starter: the same wins as on engine 0.4.1', () => {
    expect(measureRival(40)).toEqual({ sagelet: 38, blitzr: 40, forkling: 33 });
  });
});

describe('the player who reads the telegraph', () => {
  it('raises Guardrail when a telegraphed attack on it is at least 25% of its HP bar, and plays naive otherwise', () => {
    let s = createBattle(rivalBattle('sagelet', 0).setup, rivalBattle('sagelet', 0).seed);
    let guarded = 0;
    let naive = 0;
    for (let round = 0; round < 12 && !s.ended; round++) {
      const me = s.creatures[0];
      const cmd = telegraphCommand(s);
      const threat = getIntents(s).some((i) => {
        const p = i.target === 0 ? previewDamage(s, i) : null;
        return p !== null && Math.round((p.min + p.max) / 2) >= 0.25 * (me?.maxHp ?? 0);
      });
      const action = cmd.a?.action;
      if (action?.kind === 'move' && action.moveId === 'guardrail') {
        expect(threat).toBe(true);
        guarded++;
      } else {
        expect(cmd).toEqual(naiveCommand(s));
        naive++;
      }
      const r = submitRound(s, cmd);
      if ('error' in r) throw new Error(r.error.message);
      s = r.state;
    }
    expect(guarded + naive).toBeGreaterThan(0);
  });
});
