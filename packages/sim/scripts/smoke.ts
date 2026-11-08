// The archetype smoke (Task C2, reused by C5): every ordered pairing of ARCHETYPES, mirrors included (each archetype
// against mirrorOf(itself)), `--seeds N` battles each (default 10). It prints, as Markdown, the round-count
// distribution and cap hits, the mirror tally, each archetype's win rate against the field (mirrors excluded, a draw
// counts 0.5), the Pearson correlation of win rate with structural features, and how often each headline card fired.
// Deterministic: the same seeds and archetypes always print the same report (no timing).
//
//   pnpm --filter @latentia/sim exec tsx scripts/smoke.ts --seeds 10

import { activeCardCount, bandFor, moveDef, simulate, SPECIES, typeMultiplierBp, type CreatureSetup, type TypeId } from '@latentia/engine';
import { cardFires, HEADLINES } from '../src/archetypes/headlines.js';
import { ARCHETYPES, mirrorOf } from '../src/archetypes/index.js';
import { seedFor } from '../src/runner.js';
import type { Archetype } from '../src/types.js';

const CAP = 50;

function seedsArg(argv: readonly string[]): number {
  const i = argv.indexOf('--seeds');
  const n = i < 0 ? 10 : Number(argv[i + 1]);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('--seeds must be a positive integer');
  return n;
}

const speciesOf = (c: CreatureSetup) => SPECIES[c.species as keyof typeof SPECIES];
const members = (a: Archetype): CreatureSetup[] => [a.side.orchestrator, ...a.side.active, ...a.side.bench];
const subagents = (a: Archetype): CreatureSetup[] => [...a.side.active, ...a.side.bench];
const sum = (xs: readonly number[]): number => xs.reduce((n, x) => n + x, 0);
const mean = (xs: readonly number[]): number => sum(xs) / xs.length;
/** Damaging species moves' types of a team (one entry per move). */
const attackTypes = (a: Archetype): TypeId[] =>
  members(a).flatMap((c) => speciesOf(c).moves.flatMap((m) => {
    const d = moveDef(m);
    return d !== null && d.power !== undefined ? [d.type as TypeId] : [];
  }));

/** Structural features of an archetype, each correlated with win rate. */
const FEATURES: Readonly<Record<string, (a: Archetype) => number>> = {
  'team size': (a) => members(a).length,
  'mean level': (a) => mean(members(a).map((c) => c.level)),
  'total base stats': (a) => sum(members(a).map((c) => { const b = speciesOf(c).base; return b.hp + b.compute + b.robustness + b.latency; })),
  'base Compute': (a) => sum(members(a).map((c) => speciesOf(c).base.compute)),
  'base HP': (a) => sum(members(a).map((c) => speciesOf(c).base.hp)),
  'base Robustness': (a) => sum(members(a).map((c) => speciesOf(c).base.robustness)),
  'base Latency': (a) => sum(members(a).map((c) => speciesOf(c).base.latency)),
  'Code-type members': (a) => members(a).filter((c) => speciesOf(c).types.includes('code')).length,
  'Reasoning-type members': (a) => members(a).filter((c) => speciesOf(c).types.includes('reasoning')).length,
  'offense vs field (mean type bp)': (a) => {
    const foes = ARCHETYPES.filter((b) => b.id !== a.id).flatMap((b) => members(b).map((c) => speciesOf(c).types));
    return mean(attackTypes(a).flatMap((t) => foes.map((f) => typeMultiplierBp(t, f))));
  },
  'defense vs field (mean type bp taken)': (a) => {
    const atk = ARCHETYPES.filter((b) => b.id !== a.id).flatMap(attackTypes);
    return mean(members(a).flatMap((c) => atk.map((t) => typeMultiplierBp(t, speciesOf(c).types))));
  },
  'grid headroom': (a) => { const g = a.side.grid; return g === null ? 0 : g.width * g.height - sum(g.pieces.map((p) => p.shape.length)); },
  'Autopilot temperature': (a) => a.side.autopilot?.temperature ?? 0,
  'active cards (both slots)': (a) => {
    const g = a.side.grid;
    if (g === null) return 0;
    return sum(a.side.active.map((c) => activeCardCount(g, g.pieces.find((p) => p.subagentId === c.id)?.id ?? '', c.version)));
  },
  'Brittle subagents': (a) => subagents(a).filter((c) => bandFor(c.generalization ?? 50) === 'brittle').length,
  'mean generalization': (a) => mean(subagents(a).map((c) => c.generalization ?? 50)),
};

/** Pearson's r, or null when either variable is constant (r is undefined). */
function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const mx = mean(xs);
  const my = mean(ys);
  const cov = sum(xs.map((x, i) => (x - mx) * ((ys[i] as number) - my)));
  const vx = sum(xs.map((x) => (x - mx) * (x - mx)));
  const vy = sum(ys.map((y) => (y - my) * (y - my)));
  return vx === 0 || vy === 0 ? null : cov / Math.sqrt(vx * vy);
}

const fmt = (x: number, d = 2): string => (Number.isInteger(x) ? String(x) : x.toFixed(d));

function main(): void {
  const seeds = seedsArg(process.argv.slice(2));
  const tally = new Map(ARCHETYPES.map((a) => [a.id, { w: 0, l: 0, d: 0 }]));
  const fired = new Map<string, number>();
  const mirror = { a: 0, b: 0, d: 0 };
  const rounds: number[] = [];
  for (const a of ARCHETYPES) {
    for (const b0 of ARCHETYPES) {
      const isMirror = a === b0;
      const b = isMirror ? mirrorOf(b0, 'm') : b0;
      for (let i = 0; i < seeds; i++) {
        const r = simulate({ a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' }, seedFor(`smoke:${a.id}:${b0.id}`, i), { kind: 'autopilot' });
        rounds.push(r.rounds);
        for (const [creature, cards] of cardFires(r)) for (const [card, n] of cards) fired.set(`${creature.replace(/~m$/, '')}#${card}`, (fired.get(`${creature.replace(/~m$/, '')}#${card}`) ?? 0) + n);
        if (isMirror) {
          if (r.winner === 'a') mirror.a++;
          else if (r.winner === 'b') mirror.b++;
          else mirror.d++;
          continue;
        }
        const ta = tally.get(a.id) as { w: number; l: number; d: number };
        const tb = tally.get(b0.id) as { w: number; l: number; d: number };
        if (r.winner === 'a') { ta.w++; tb.l++; } else if (r.winner === 'b') { tb.w++; ta.l++; } else { ta.d++; tb.d++; }
      }
    }
  }
  rounds.sort((x, y) => x - y);
  const q = (p: number): number => rounds[Math.floor(p * (rounds.length - 1))] as number;
  const rate = (id: string): number => { const t = tally.get(id) as { w: number; l: number; d: number }; return (t.w + t.d / 2) / (t.w + t.l + t.d); };
  const out: string[] = [];
  out.push(`# Archetype smoke: ${ARCHETYPES.length * ARCHETYPES.length} pairings (mirrors included) × ${seeds} seeds = ${rounds.length} battles`, '');
  out.push(`- Rounds: p25 ${q(0.25)}, median ${q(0.5)}, p75 ${q(0.75)}, min ${rounds[0]}, max ${rounds.at(-1)}; cap (${CAP}) hits ${rounds.filter((r) => r >= CAP).length}.`);
  out.push(`- Mirrors: side A ${mirror.a}, side B ${mirror.b}, draws ${mirror.d}.`, '');
  out.push('| archetype | W | L | D | win % vs field |', '|---|---|---|---|---|');
  for (const a of [...ARCHETYPES].sort((x, y) => rate(y.id) - rate(x.id) || (x.id < y.id ? -1 : 1))) {
    const t = tally.get(a.id) as { w: number; l: number; d: number };
    out.push(`| ${a.id} | ${t.w} | ${t.l} | ${t.d} | ${(100 * rate(a.id)).toFixed(1)}% |`);
  }
  out.push('', '| feature | r with win rate | range |', '|---|---|---|');
  const ys = ARCHETYPES.map((a) => rate(a.id));
  for (const [name, f] of Object.entries(FEATURES)) {
    const xs = ARCHETYPES.map(f);
    const r = pearson(xs, ys);
    out.push(`| ${name} | ${r === null ? 'undefined (constant)' : r.toFixed(2)} | ${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))} |`);
  }
  out.push('', '| archetype | headline card fires (creature card: count) |', '|---|---|');
  for (const a of ARCHETYPES) {
    const cards = (HEADLINES[a.id] ?? []).map(({ creature, card }) => `${creature} ${card}: ${fired.get(`${a.id}/${creature}#${card}`) ?? 0}`);
    out.push(`| ${a.id} | ${cards.join(', ')} |`);
  }
  console.log(out.join('\n'));
}

main();
