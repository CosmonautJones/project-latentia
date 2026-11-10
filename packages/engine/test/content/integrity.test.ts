import { describe, expect, it } from 'vitest';
import { TYPES } from '../../src/content/ids.js';
import { LAUNCH_MOVE_IDS, MOVES, SIGNATURE_MOVE_IDS, type MoveId } from '../../src/content/moves.js';
import { DRAW_SLOTS, EFFECT_KINDS, type Effect } from '../../src/content/primitives.js';
import { SPECIES, SPECIES_IDS } from '../../src/content/species.js';
import { STATUSES } from '../../src/content/statuses.js';

/** Bible "57-move launch list", verbatim: [name, power, ctx cost, accuracy, priority]. */
const LAUNCH: Record<string, readonly (readonly [string, number | null, number, number | null, number])[]> = {
  reasoning: [
    ['Chain of Thought', 60, 2, 100, 0],
    ['Deliberate', 130, 4, 95, -1],
    ['Step-Back Prompt', null, 1, null, 0],
    ['Proof by Contradiction', 70, 2, 90, 0],
    ['Socratic Method', null, 1, null, 0],
    ['Tree Search', 85, 3, 100, 0],
  ],
  speed: [
    ['Token Burst', 40, 1, 100, 1],
    ['Speculative Decoding', 22, 2, 90, 0],
    ['Low Latency', null, 1, null, 0],
    ['Early Exit', 50, 1, 100, 3], // spec §5 Levers: Early Exit resolves at +3
    ['Distilled Strike', 75, 1, 95, 0],
    ['Flash Inference', 90, 3, 85, 1],
  ],
  open: [
    ['Fork', null, 1, null, 0],
    ['Community Patch', null, 2, null, 0],
    ['Weights Dump', 100, 3, 90, 0],
    ['Permissive License', null, 1, null, 0],
    ['Swarm of Fine-Tunes', 15, 2, 100, 0],
    ['Leaderboard Flex', 65, 2, 100, 0],
  ],
  code: [
    ['Stack Trace', 65, 2, 100, 0],
    ['Hotfix', null, 2, null, 1],
    ['Infinite Loop', null, 2, 85, 0],
    ['Segfault', 110, 3, 80, 0],
    ['Unit Test', null, 1, null, 3],
    ['Refactor', null, 0, null, 0],
    ['Merge Conflict', 55, 2, 100, 0],
  ],
  vision: [
    ['Pixel Peep', 50, 1, 100, 0],
    ['Bounding Box', null, 1, null, 0],
    ['Adversarial Patch', 70, 2, 90, 0],
    ['Screenshot', null, 1, null, 0],
    ['Saliency Map', null, 2, null, 0],
    ['Captcha Wall', null, 1, null, 4],
  ],
  voice: [
    ['Hype Train', null, 1, null, 0],
    ['Hot Take', 90, 2, 85, 0],
    ['Deepfake Call', null, 3, 75, 0],
    ['Earnest Apology', null, 1, null, 0],
    ['Filibuster', 40, 1, 100, 0],
    ['Flattery', null, 1, 90, 0],
  ],
  search: [
    ['Ground Truth', null, 1, null, 1],
    ['Deep Research', 140, 4, 100, -1],
    ['Citation Needed', 60, 2, 100, 0],
    ['Rerank', null, 1, null, 2],
    ['Retrieval Strike', 70, 1, 100, 0],
    ['Fact Check', null, 1, 100, 0],
  ],
  memory: [
    ['Long-Term Recall', 40, 2, 100, 0],
    ['Save State', null, 3, null, 0],
    ['Embedding Cache', null, 1, null, 0],
    ['Memory Leak', 50, 1, 100, 0],
    ['Episodic Replay', null, 0, null, 0], // cost is (copied cost - 1), carried by the copy effect
  ],
  system: [
    ['Compact', null, 0, null, -2],
    ['/clear', null, 0, null, -3],
    ['Guardrail', null, 1, null, 4],
    ['Refusal', null, 1, null, 4],
    ['Policy Update', null, 2, null, 0],
    ['Directive', null, 2, null, 0],
    ['Temperature Spike', null, 1, 90, 0],
    ['Red Team', null, 2, null, 0],
    ['Throttle', null, 1, 85, 0],
  ],
};

const SLICE_SPECIES = [
  'Sagelet', 'Blitzr', 'Forkling', 'Tokenibble', 'Stochastiparrot', 'Nullbeetle', 'Off-By-Wasp', 'Heisenmoth', 'Embeddingo',
  'Slopling', 'Hallucinat', 'Deprecatter', 'Cobolt', 'Scrapion', 'Vibrat', 'Spaghettopus', 'Agentoad',
];

const ids = Object.keys(MOVES) as MoveId[];
const byName = new Map(ids.map((id) => [MOVES[id].name, MOVES[id]]));
const move = (name: string) => {
  const m = byName.get(name);
  if (m === undefined) throw new Error(`missing move ${name}`);
  return m;
};

/** Every object reachable from `v`, with the path to it. */
function walk(v: unknown, path: string, out: { path: string; obj: Record<string, unknown> }[] = []) {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${String(i)}]`, out));
  else if (typeof v === 'object' && v !== null) {
    out.push({ path, obj: v as Record<string, unknown> });
    for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
  }
  return out;
}

const allEffects = (effects: readonly Effect[] | undefined) => walk(effects ?? [], '').map((o) => o.obj).filter((o) => 'kind' in o && EFFECT_KINDS.includes(o.kind as never));

describe('launch moves', () => {
  it('57 launch moves: 48 typed (6 per type, code 7, memory 5) and 9 system', () => {
    expect(LAUNCH_MOVE_IDS).toHaveLength(57);
    const count = (t: string) => LAUNCH_MOVE_IDS.filter((id) => MOVES[id].type === t).length;
    for (const t of TYPES) expect(count(t), t).toBe(t === 'code' ? 7 : t === 'memory' ? 5 : 6);
    expect(count('system')).toBe(9);
  });

  it('every bible move is present with its exact power, cost, accuracy and priority', () => {
    const launchNames = LAUNCH_MOVE_IDS.map((id) => MOVES[id].name).sort();
    expect(launchNames).toEqual(Object.values(LAUNCH).flat().map((r) => r[0]).sort());
    for (const [type, rows] of Object.entries(LAUNCH)) {
      for (const [name, power, cost, accuracy, priority] of rows) {
        const m = move(name);
        expect({ name, type: m.type, power: m.power, cost: m.cost, accuracy: m.accuracy, priority: m.priority }).toEqual({ name, type, power, cost, accuracy, priority });
      }
    }
  });

  it('"Hype Train" present, "Hype Cycle" absent', () => {
    expect(byName.has('Hype Train')).toBe(true);
    expect(byName.has('Hype Cycle')).toBe(false);
  });

  it('universal and orchestrator-only flags', () => {
    expect(ids.filter((id) => MOVES[id].universal === true).sort()).toEqual(['clear', 'compact', 'guardrail']);
    expect(ids.filter((id) => MOVES[id].orchestratorOnly === true).sort()).toEqual(['directive', 'policy-update']);
  });

  it('system priorities and costs', () => {
    expect([move('Compact').cost, move('Compact').priority]).toEqual([0, -2]);
    expect(move('/clear').priority).toBe(-3);
    for (const g of ['Guardrail', 'Refusal', 'Captcha Wall']) expect(move(g).priority, g).toBe(4);
    expect(move('Unit Test').priority).toBe(3);
  });
});

describe('move data shape', () => {
  it('ids are kebab-case keys that match their id field', () => {
    for (const id of ids) {
      expect(MOVES[id].id).toBe(id);
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(ids.map((id) => MOVES[id].name)).size).toBe(ids.length);
  });

  it('every effect is a known primitive; passives appear only on species', () => {
    for (const id of ids) {
      const m = MOVES[id];
      for (const list of [m.effects, m.wild, m.wildT4]) {
        for (const e of list ?? []) {
          expect(EFFECT_KINDS, `${id}: ${e.kind}`).toContain(e.kind);
          expect(e.kind, id).not.toBe('passive');
        }
      }
    }
  });

  it('only the levers have no effects', () => {
    expect(ids.filter((id) => MOVES[id].effects.length === 0).sort()).toEqual(['directive', 'policy-update']);
  });

  it('damage moves have power; non-damage moves do not', () => {
    for (const id of ids) {
      const m = MOVES[id];
      const hits = m.effects.some((e) => (e.kind === 'damage' && e.who === 'target') || e.kind === 'multiHit');
      const copiesMove = m.effects.some((e) => e.kind === 'copy' && e.what === 'move');
      if (!copiesMove) expect(m.power !== null, id).toBe(hits);
      if (m.accuracy !== null) expect(m.accuracy > 0 && m.accuracy <= 100, id).toBe(true);
    }
  });

  it('every primitive kind is used by some move or species passive', () => {
    const used = new Set<string>();
    for (const id of ids) for (const l of [MOVES[id].effects, MOVES[id].wild, MOVES[id].wildT4]) for (const e of allEffects(l)) used.add(e.kind as string);
    for (const s of SPECIES_IDS) for (const e of allEffects(SPECIES[s].passives)) used.add(e.kind as string);
    expect([...used].sort()).toEqual([...EFFECT_KINDS].sort());
  });

  it('is plain JSON data and deeply frozen', () => {
    expect(JSON.parse(JSON.stringify(MOVES))).toEqual(MOVES);
    expect(JSON.parse(JSON.stringify(SPECIES))).toEqual(SPECIES);
    for (const { path, obj } of [...walk(MOVES, 'MOVES'), ...walk(SPECIES, 'SPECIES')]) expect(Object.isFrozen(obj), path).toBe(true);
  });
});

describe('draw slots', () => {
  const moveEffects = ids.flatMap((id) => [MOVES[id].effects, MOVES[id].wild, MOVES[id].wildT4].map((l) => ({ id, l: l ?? [] })));

  it('every chance names a valid slot; move riders use d6lo, passive procs use r2hi', () => {
    for (const { id, l } of moveEffects) {
      for (const { path, obj } of walk(l, id)) {
        if ('chance' in obj) {
          const c = obj.chance as { pct: number; slot: string };
          expect(DRAW_SLOTS, path).toContain(c.slot);
          expect(c.slot, path).toBe('d6lo');
          expect(Number.isInteger(c.pct) && c.pct > 0 && c.pct < 100, path).toBe(true);
        }
      }
    }
    for (const s of SPECIES_IDS) {
      for (const { path, obj } of walk(SPECIES[s].passives, s)) {
        if ('chance' in obj) expect((obj.chance as { slot: string }).slot, path).toBe('r2hi');
      }
    }
  });

  it('every species passive chance reads r2hi, the round-start passive proc (Ruling 65)', () => {
    const chances = SPECIES_IDS.flatMap((s) => walk(SPECIES[s].passives, s).filter(({ obj }) => 'chance' in obj));
    expect(chances.length).toBeGreaterThan(0); // Blitzr's Move Fast recoil, at least
    for (const { path, obj } of chances) expect((obj.chance as { slot: string }).slot, path).toBe('r2hi');
  });

  it('random durations, hit counts, guard checks and random picks name their slot', () => {
    for (const { id, l } of moveEffects) {
      for (const e of allEffects(l)) {
        if (e.kind === 'applyStatus') {
          const st = STATUSES[e.status as keyof typeof STATUSES];
          if (st.durationMin !== st.durationMax) expect(e.durationSlot, id).toBe('d6hi');
          else expect(e.durationSlot, id).toBeUndefined();
        }
        if (e.kind === 'multiHit' && (e.count as { kind: string }).kind === 'range') expect((e.count as { slot: string }).slot, id).toBe('d5hi');
        if (e.kind === 'guard') expect(e.successSlot, id).toBe('d3lo');
        if (e.kind === 'copy' && e.pick === 'random') expect(e.pickSlot, id).toBe('d6hi');
      }
    }
  });

  it('no move uses the d6hi magnitude slot twice', () => {
    for (const { id, l } of moveEffects) expect(JSON.stringify(l).split('"d6hi"').length - 1, id).toBeLessThanOrEqual(1);
  });
});

describe('wild riders', () => {
  it('exactly the bible Wild moves carry wild and an explicit wildT4', () => {
    const wild = ids.filter((id) => MOVES[id].wild !== undefined).sort();
    expect(wild).toEqual(['hot-take', 'hype-train', 'permissive-license', 'speculative-decoding']);
    for (const id of ids) if (MOVES[id].wildT4 !== undefined) expect(MOVES[id].wild, id).toBeDefined();
  });

  it('no doubling flag anywhere: T4 behaviour only via wildT4', () => {
    for (const { path, obj } of [...walk(MOVES, 'MOVES'), ...walk(SPECIES, 'SPECIES')]) {
      for (const k of Object.keys(obj)) expect(k, path).not.toMatch(/doubl|twice|x2/i);
    }
  });

  it('wild values are written out', () => {
    const range = (id: MoveId, l: 'effects' | 'wild' | 'wildT4') => {
      const e = MOVES[id][l]?.[0];
      return e?.kind === 'multiHit' && e.count.kind === 'range' ? [e.count.min, e.count.max] : null;
    };
    expect(range('speculative-decoding', 'effects')).toEqual([2, 5]);
    expect(range('speculative-decoding', 'wild')).toEqual([2, 6]);
    const hot = MOVES['hot-take'].wild?.[0];
    expect(hot?.kind === 'damage' && hot.who === 'target' ? hot.mult : null).toEqual([{ bp: 15000 }]);
  });
});

describe('bible effect values', () => {
  it('conditional power is typed', () => {
    expect(MOVES['chain-of-thought'].effects[0]).toMatchObject({ kind: 'damage', bonus: { kind: 'perCount', per: 20, cap: { of: 'bonus', value: 60 } } });
    expect(MOVES['long-term-recall'].effects[0]).toMatchObject({ kind: 'damage', bonus: { kind: 'perCount', counter: { kind: 'hitsTakenFromTarget' }, per: 10, cap: { of: 'power', value: 120 } } });
    expect(MOVES['leaderboard-flex'].effects[0]).toMatchObject({ kind: 'damage', bonus: { kind: 'flat', add: 30, when: { kind: 'userHpPctAboveTarget' } } });
    expect(MOVES['proof-by-contradiction'].effects[0]).toMatchObject({ kind: 'damage', mult: [{ bp: 20000, when: { kind: 'targetLastRound', did: ['buffed', 'usedStatusMove'] } }] });
  });

  it('secondary chances', () => {
    expect(MOVES.segfault.effects[1]).toMatchObject({ kind: 'nextActionModifier', who: 'target', modifier: { kind: 'fail' }, chance: { pct: 20, slot: 'd6lo' } });
    expect(MOVES['adversarial-patch'].effects[1]).toMatchObject({ kind: 'applyStatus', status: 'hallucinating', chance: { pct: 30, slot: 'd6lo' }, durationSlot: 'd6hi' });
  });
});

describe('review fixes', () => {
  it('every Search move that deals damage also cures Hallucinating on the target (bible status table)', () => {
    const search = ids.filter((id) => MOVES[id].type === 'search' && MOVES[id].effects.some((e) => (e.kind === 'damage' && e.who === 'target') || e.kind === 'multiHit'));
    expect(search.sort()).toEqual(['citation-needed', 'cosine-sniff', 'deep-research', 'retrieval-strike', 'scrape']);
    for (const id of search) {
      const cures = MOVES[id].effects.filter((e) => e.kind === 'cure' && e.who === 'target' && e.statuses.includes('hallucinating'));
      expect(cures, id).toHaveLength(1);
    }
  });

  it("/clear skips only the orchestrator's next command", () => {
    expect(MOVES.clear.effects).toContainEqual({ kind: 'nextActionModifier', who: 'self', modifier: { kind: 'skip', reason: 'cleared', scope: 'orchestratorCommand' } });
  });

  it('passives are a flat array per species with no nested passives', () => {
    for (const s of SPECIES_IDS) {
      expect(Array.isArray(SPECIES[s].passives), s).toBe(true);
      for (const p of SPECIES[s].passives) {
        expect(p.kind, s).toBe('passive');
        for (const e of p.effects) expect(e.kind as string, s).not.toBe('passive');
      }
    }
    expect(SPECIES.tokenibble.passives).toEqual([]);
  });

  it('Blitzr Move Fast splits into a battleStart priority and an afterFirstAction recoil proc', () => {
    expect(SPECIES.blitzr.passives).toEqual([
      { kind: 'passive', trigger: 'battleStart', effects: [{ kind: 'nextActionModifier', who: 'self', modifier: { kind: 'priority', delta: 1 } }] },
      { kind: 'passive', trigger: 'afterFirstAction', effects: [{ kind: 'damage', who: 'self', pctOfDealt: 10, chance: { pct: 15, slot: 'r2hi' } }] },
    ]);
  });
});

describe('slice species', () => {
  it('exactly the 17 species marked S in the ModelDex', () => {
    expect(SPECIES_IDS.map((s) => SPECIES[s].name)).toEqual(SLICE_SPECIES);
    for (const s of SPECIES_IDS) expect(SPECIES[s].id).toBe(s);
  });

  it('one distinct signature per species; every species move resolves', () => {
    expect(SIGNATURE_MOVE_IDS).toHaveLength(17);
    expect(SPECIES_IDS.map((s) => SPECIES[s].signature).sort()).toEqual([...SIGNATURE_MOVE_IDS].sort());
    for (const s of SPECIES_IDS) {
      const sp = SPECIES[s];
      expect(sp.moves, s).toHaveLength(4);
      expect(sp.moves, s).toContain(sp.signature);
      for (const m of sp.moves) {
        expect(MOVES[m], `${s}: ${m}`).toBeDefined();
        expect(MOVES[m].universal ?? MOVES[m].orchestratorOnly, `${s}: ${m}`).toBeUndefined();
      }
      for (const t of sp.types) expect(TYPES, s).toContain(t);
      expect(sp.types.length === 1 || sp.types.length === 2, s).toBe(true);
    }
  });

  it('placeholder signatures stay in band: power 50-90 (multi-hit: expected total), cost 1-3, accuracy 90-100, priority 0', () => {
    for (const id of SIGNATURE_MOVE_IDS) {
      const m = MOVES[id];
      const multi = m.effects.find((e) => e.kind === 'multiHit');
      const copiesMove = m.effects.some((e) => e.kind === 'copy' && e.what === 'move');
      if (copiesMove) expect(m.power, id).toBeNull();
      else {
        const p = m.power ?? 0;
        const total2 = multi?.kind === 'multiHit' && multi.count.kind === 'range' ? p * (multi.count.min + multi.count.max) : 2 * p;
        expect(total2 >= 100 && total2 <= 180, `${id} power`).toBe(true);
      }
      expect(m.cost >= 1 && m.cost <= 3, `${id} cost`).toBe(true);
      expect(m.accuracy !== null && m.accuracy >= 90 && m.accuracy <= 100, `${id} accuracy`).toBe(true);
      expect(m.priority, id).toBe(0);
    }
  });

  it('placeholder stats: base 40-90, ctx 10-16, starter totals within 5% of each other', () => {
    for (const s of SPECIES_IDS) {
      for (const v of Object.values(SPECIES[s].base)) expect(v >= 40 && v <= 90, s).toBe(true);
      expect(SPECIES[s].ctx >= 10 && SPECIES[s].ctx <= 16, s).toBe(true);
    }
    const totals = (['sagelet', 'blitzr', 'forkling'] as const).map((s) => Object.values(SPECIES[s].base).reduce((a, b) => a + b, 0));
    expect(100 * Math.max(...totals)).toBeLessThanOrEqual(105 * Math.min(...totals));
  });

  it('every graft shape has 3-4 distinct, orthogonally connected cells', () => {
    for (const s of SPECIES_IDS) {
      const cells = SPECIES[s].graftShape;
      const keys = new Set(cells.map(([x, y]) => `${String(x)},${String(y)}`));
      expect(cells.length >= 3 && cells.length <= 4, s).toBe(true);
      expect(keys.size, s).toBe(cells.length);
      const seen = new Set<string>();
      const stack = [cells[0]];
      while (stack.length > 0) {
        const c = stack.pop();
        if (c === undefined) continue;
        const k = `${String(c[0])},${String(c[1])}`;
        if (seen.has(k) || !keys.has(k)) continue;
        seen.add(k);
        stack.push([c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]);
      }
      expect(seen.size, s).toBe(cells.length);
    }
  });
});
