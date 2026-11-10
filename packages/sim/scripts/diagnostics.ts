// The balance-pass diagnostics (Task C5 scratch, committed by Ruling 143 I4). Each subcommand builds its variants in
// memory (nothing in the repo is edited), runs them deterministically on its own `c5diag:` seed labels, and prints
// Markdown table rows: label, battles, score (a draw counts 0.5) and 95% Wilson interval.
//
//   pnpm --filter @latentia/sim diagnostics graft   # what a graft and a spin-up are each worth (finding 4)
//   pnpm --filter @latentia/sim diagnostics hallu   # how often Hallucinating happens, and the anti-hallucination cards fire (finding 6)
//   pnpm --filter @latentia/sim diagnostics temp    # T0 vs T4 on every archetype (finding 7)
//
// `--seeds N` replaces the subcommand's battle count (per side assignment for graft and temp, per ordered pairing for
// hallu; defaults 1000, 250 and 50) so a quick look costs little; the default numbers are the ones the notes cite. Like
// the sim commands, an unknown or misspelt argument is a usage error (exit code 2).
//
// `temp` is also in `pnpm sim targets` as diagnostic rows (on other seeds), and so is G vs S (graft); `hallu` and the
// breakdown in `graft` are here only.

import { parseArgs, UsageError, num, type CommandSpec } from '../src/args.js';
import { activeCardCount, simulate, SPECIES, type BattleSetup, type CreatureSetup } from '@latentia/engine';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { runPooled, seedFor } from '../src/runner.js';
import { rate, wilson95 } from '../src/stats.js';
import { baseTeam, GRAFT_SPECIES, graftVariant, spinUpVariant, subagentTemplate, temperaturePair } from '../src/target-setups.js';
import type { Archetype, Score } from '../src/types.js';

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
function show(label: string, s: Score): void {
  const [lo, hi] = wilson95(s.points, s.n);
  console.log(`| ${label} | ${s.n} | ${pct(rate(s))} | [${pct(lo)}, ${pct(hi)}] |`);
}
const header = (first: string): void => console.log(`| ${first} | battles | score | 95% interval |\n|---|---|---|---|`);

/** Default battles per side assignment in the graft and temperature diagnostics. */
const GRAFT_PER_SIDE = 1000;
const TEMP_PER_SIDE = 250;
/** Default battles per ordered pairing in the Hallucinating count (each archetype on each side against the other 19). */
const HALLU_PER_PAIRING = 50;
/** The `--seeds N` override, set once by the entry point below. */
let seedsOverride: number | undefined;
const seeds = (fallback: number): number => seedsOverride ?? fallback;

/** S's spun-up subagent replaced by `c` (built from it): the same slot, id and training. */
function withSpun(s: Archetype, make: (spun: CreatureSetup) => CreatureSetup): Archetype {
  const [intern, spun] = s.side.active;
  if (intern === undefined || spun === undefined) throw new Error(`${s.id} has no spun-up subagent`);
  return { id: s.id, side: { ...s.side, active: [intern, make(spun)] } };
}

/**
 * G and S against the base team (Sagelet + Tokenibble, no graft, no second subagent), and G against three forms of
 * S: the current one (L5, 1 active card, no signature: Rulings 143, 145, 147), the same at L8, and the C5 one (L8 with
 * its signature; since Ruling 147 on the 1-card grid, so no longer the C5 setup's 2 cards).
 */
function graft(): void {
  header('matchup (first side’s score)');
  const base = baseTeam();
  for (const sp of GRAFT_SPECIES) {
    const g = graftVariant(sp);
    const s = spinUpVariant(sp);
    const grid = s.side.grid;
    if (grid === null) throw new Error(`${s.id} has no grid`);
    const atL8 = withSpun(s, (c) => ({ ...c, level: 8, version: 'v2' }));
    const c5 = withSpun(s, (c) => ({ ...c, level: 8, version: 'v2', moves: [...SPECIES[sp].moves], deck: subagentTemplate(sp, activeCardCount(grid, 'slot-B', 'v2')) }));
    show(`${sp}: G vs base`, runPooled(g, base, seeds(GRAFT_PER_SIDE), `c5diag:graft:g-base:${sp}`).score);
    show(`${sp}: S (L5, no signature) vs base`, runPooled(s, base, seeds(GRAFT_PER_SIDE), `c5diag:graft:s-base:${sp}`).score);
    show(`${sp}: G vs S (L5, 1 card, no signature; the diagnostic setup)`, runPooled(g, s, seeds(GRAFT_PER_SIDE), `c5diag:graft:g-s:${sp}`).score);
    show(`${sp}: G vs S at L8, no signature`, runPooled(g, atL8, seeds(GRAFT_PER_SIDE), `c5diag:graft:g-s8:${sp}`).score);
    show(`${sp}: G vs S at L8 with signature (C5's S, on the 1-card grid)`, runPooled(g, c5, seeds(GRAFT_PER_SIDE), `c5diag:graft:g-c5:${sp}`).score);
  }
}

/**
 * Per archetype x, over HALLU_PER_PAIRING battles per ordered pairing against every other archetype (x on each side):
 * the share of battles in which a creature of x's side, or of the foe's, became Hallucinating, and how often x's
 * anti-hallucination cards (Citation Needed `cite`, Ground Truth `ground`) fired, per creature.
 */
function hallu(): void {
  console.log('| archetype | battles | own side Hallucinating | foe Hallucinating | anti-hallucination card fires |\n|---|---|---|---|---|');
  const members = (s: BattleSetup['a']) => [s.orchestrator, ...s.active, ...s.bench];
  for (const x of ARCHETYPES) {
    let battles = 0;
    let own = 0;
    let foe = 0;
    const fires = new Map<string, number>();
    for (const y of ARCHETYPES) {
      if (y.id === x.id) continue;
      for (const [a, b, xIsA] of [[x, y, true], [y, x, false]] as const) {
        const setup: BattleSetup = { a: { ...a.side, opponentId: b.id }, b: { ...b.side, opponentId: a.id }, kind: 'trainer' };
        const ids = [...members(setup.a), ...members(setup.b)].map((c) => c.id);
        const nA = members(setup.a).length;
        const mine = (i: number): boolean => (xIsA ? i < nA : i >= nA);
        for (let i = 0; i < seeds(HALLU_PER_PAIRING); i++) {
          const r = simulate(setup, seedFor(`c5diag:hallu:${a.id}:${b.id}`, i), { kind: 'autopilot' });
          battles++;
          let ownHit = false;
          let foeHit = false;
          for (const e of r.events) {
            if (e.type === 'StatusApplied' && e.status === 'hallucinating') {
              if (mine(e.target)) ownHit = true;
              else foeHit = true;
            }
            if (e.type === 'CardTrace' && mine(e.actor) && (e.firedCardId === 'cite' || e.firedCardId === 'ground')) {
              const k = `${ids[e.actor]?.split('/')[1]}:${e.firedCardId}`;
              fires.set(k, (fires.get(k) ?? 0) + 1);
            }
          }
          if (ownHit) own++;
          if (foeHit) foe++;
        }
      }
    }
    console.log(`| ${x.id} | ${battles} | ${pct(own / battles)} | ${pct(foe / battles)} | ${[...fires].map(([k, v]) => `${k} ${v}`).join(', ') || '—'} |`);
  }
}

/** The temperature dial on every archetype: x at T0 vs its own mirror at T4, both sides pooled (the T0 side's score). */
function temp(): void {
  header('archetype (its own temperature): T0 side vs T4 mirror');
  for (const x of ARCHETYPES) show(`${x.id} (own T${x.side.autopilot?.temperature})`, runPooled(...temperaturePair(x), seeds(TEMP_PER_SIDE), `c5diag:temp:${x.id}`).score);
}

const SUBCOMMANDS: Record<string, () => void> = { graft, hallu, temp };
const SPEC: CommandSpec = { name: 'diagnostics', positionals: ['subcommand'], flags: { seeds: 'int' } };

try {
  const p = parseArgs(process.argv.slice(2), SPEC);
  const which = p.positionals[0] as string;
  const run = Object.prototype.hasOwnProperty.call(SUBCOMMANDS, which) ? SUBCOMMANDS[which] : undefined;
  if (run === undefined) throw new UsageError(`unknown subcommand ${which} (one of ${Object.keys(SUBCOMMANDS).join(', ')})`);
  seedsOverride = p.flags.has('seeds') ? num(p, 'seeds', 0) : undefined;
  run();
} catch (e) {
  if (!(e instanceof UsageError)) throw e;
  console.error(e.message);
  process.exitCode = 2;
}
