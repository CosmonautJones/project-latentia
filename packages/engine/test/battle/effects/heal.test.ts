import { describe, expect, it } from 'vitest';
import type { BattleState } from '../../../src/battle/state.js';
import { at } from '../helpers.js';
import { fresh, ofType, run } from './kit.js';

describe('heal', () => {
  it('heals pct% of max HP on the target and caps at max HP (Healed carries the HP actually restored)', () => {
    const s = fresh();
    at(s, 1).hp = 200;
    expect(ofType(run(s, 2, 'community-patch', 1), 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 150, hpAfter: 350 }]);
    at(s, 1).hp = 450;
    expect(ofType(run(s, 2, 'community-patch', 1), 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 50, hpAfter: 500 }]);
    expect(ofType(run(s, 2, 'community-patch', 1), 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 0, hpAfter: 500 }]);
  });

  it('floors: 30% of 21 max HP is 6', () => {
    const s = fresh();
    at(s, 1).maxHp = 21;
    at(s, 1).hp = 1;
    expect(ofType(run(s, 2, 'community-patch', 1), 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 6, hpAfter: 7 }]);
  });

  it("a Tool step raises a heal by 10% (an orchestrator Skill's percentage ×11000), a compacted Skill heals 50%", () => {
    const gridded = (): BattleState => {
      const s = fresh();
      // Skill (0,0)-(1,0) holding Community Patch with a Tool at (2,0).
      s.sides.a.grid = {
        width: 5,
        height: 4,
        pieces: [
          { id: 'sk', kind: 'skill', shape: [[0, 0], [1, 0]], anchor: [0, 0], rotation: 0, moveId: 'community-patch' },
          { id: 'tl', kind: 'tool', shape: [[0, 0]], anchor: [2, 0], rotation: 0 },
        ],
      };
      at(s, 1).hp = 100;
      return s;
    };
    const plain = fresh();
    at(plain, 1).hp = 100;
    expect(ofType(run(plain, 0, 'community-patch', 1), 'Healed')[0]?.amount).toBe(150); // 30%
    const tooled = gridded();
    expect(ofType(run(tooled, 0, 'community-patch', 1), 'Healed')[0]?.amount).toBe(165); // 33%
    const summarized = gridded();
    at(summarized, 0).context.summarizedPieces.push('sk');
    expect(ofType(run(summarized, 0, 'community-patch', 1), 'Healed')[0]?.amount).toBe(82); // 30% ×1.1 ×0.5 = 1650 bp
    const sub = gridded();
    expect(ofType(run(sub, 2, 'community-patch', 1), 'Healed')[0]?.amount).toBe(150); // subagents have no grid bonus
  });

  it('Earnest Apology heals its user 20%, clears 1 Drift and arms a 7000 modifier on the next hit it takes', () => {
    const s = fresh();
    at(s, 1).hp = 100;
    at(s, 1).context.drift = 2;
    const events = run(s, 1, 'earnest-apology', 1);
    expect(ofType(events, 'Healed')).toEqual([{ round: 1, type: 'Healed', target: 1, amount: 100, hpAfter: 200 }]);
    expect(ofType(events, 'DriftChanged')).toEqual([{ round: 1, type: 'DriftChanged', target: 1, drift: 1 }]);
    expect(at(s, 1).nextActionMods).toEqual([{ kind: 'incomingDamageBp', bp: 7000 }]);
  });

  it('does not heal a KO’d target', () => {
    const s = fresh();
    at(s, 1).hp = 0;
    at(s, 1).fainted = true;
    // The move is re-aimed at a living ally (Ruling 35); the KO'd one stays down.
    expect(ofType(run(s, 2, 'community-patch', 1), 'Healed').map((e) => e.target)).not.toContain(1);
    expect(at(s, 1).hp).toBe(0);
  });
});
