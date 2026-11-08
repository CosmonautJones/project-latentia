import { EngineInvariantError, replay, simulate, type BattleSetup, type SeedHex, type Temperature } from '@latentia/engine';
import { num, parseArgs, tag, type CommandSpec } from '../args.js';
import { ARCHETYPES, mirrorOf } from '../archetypes/index.js';
import { fmtCount, fmtSeconds, writeReport, type Report } from '../report.js';
import { endedByCap, seedFor } from '../runner.js';
import type { Archetype, CommandContext } from '../types.js';

// `pnpm sim fuzz --battles N` (spec §9): random legal battles through the engine's public API only (no engine test
// helpers). A small generator over ARCHETYPES: a random pairing (mirrors included, via mirrorOf), each side's Autopilot
// at a random temperature or, one time in eight, removed (that side plays its default intents). Each battle is
// replayed from its log, and must give the same hash. Exit code 1 when any battle fails.

const MAX_LISTED = 20;

export const FUZZ: CommandSpec = { name: 'fuzz', positionals: [], flags: { battles: 'int', tag: 'tag' } };

/** The engine entry points fuzz drives: the real ones, or (in tests) a faulty stand-in to exercise the failure paths. */
export type FuzzEngine = { simulate: typeof simulate; replay: typeof replay };
const ENGINE: FuzzEngine = { simulate, replay };

export type FuzzCase = { a: string; b: string; seed: SeedHex; setup: BattleSetup };

/** A copy of `a`'s side with its Autopilot at `t`, or without one when `t` is null. */
function sideWith(a: Archetype, opponentId: string, t: Temperature | null): BattleSetup['a'] {
  const { autopilot, ...rest } = a.side;
  if (t === null || autopilot === undefined) return { ...rest, opponentId };
  return { ...rest, autopilot: { deck: autopilot.deck, temperature: t }, opponentId };
}

/** The `i`th fuzz battle, drawn from `seedFor('fuzz:case', i)`: deterministic per index. */
export function fuzzCase(i: number): FuzzCase {
  const hex = seedFor('fuzz:case', i);
  const word = (k: number): number => parseInt(hex.slice(8 * k, 8 * k + 8), 16);
  const a = ARCHETYPES[word(0) % ARCHETYPES.length] as Archetype;
  const b0 = ARCHETYPES[word(1) % ARCHETYPES.length] as Archetype;
  const b = a === b0 ? mirrorOf(b0, 'm') : b0;
  const temp = (w: number): Temperature | null => (w % 8 === 0 ? null : ((w >>> 3) % 5) as Temperature);
  return { a: a.id, b: b0.id, seed: seedFor('fuzz:battle', i), setup: { a: sideWith(a, b.id, temp(word(2))), b: sideWith(b, a.id, temp(word(3))), kind: 'trainer' } };
}

export type FuzzFailure = { index: number; a: string; b: string; seed: string; kind: 'exception' | 'invariant' | 'replay'; message: string };
export type FuzzResult = { battles: number; exceptions: number; invariantErrors: number; replayMismatches: number; capHits: number; failures: FuzzFailure[] };

export function runFuzz(battles: number, opts: { onProgress?: (done: number) => void; engine?: FuzzEngine } = {}): FuzzResult {
  const engine = opts.engine ?? ENGINE;
  const r: FuzzResult = { battles, exceptions: 0, invariantErrors: 0, replayMismatches: 0, capHits: 0, failures: [] };
  const fail = (f: FuzzFailure): void => {
    if (r.failures.length < MAX_LISTED) r.failures.push(f);
  };
  for (let i = 0; i < battles; i++) {
    const c = fuzzCase(i);
    const where = { index: i, a: c.a, b: c.b, seed: c.seed };
    try {
      const res = engine.simulate(c.setup, c.seed, { kind: 'autopilot' });
      if (endedByCap(res)) r.capHits++;
      const again = engine.replay(res.log);
      if ('error' in again || again.hash !== res.hash) {
        r.replayMismatches++;
        fail({ ...where, kind: 'replay', message: 'error' in again ? `replay error ${again.error.code}` : `hash ${again.hash} ≠ ${res.hash}` });
      }
    } catch (e) {
      const invariant = e instanceof EngineInvariantError;
      if (invariant) r.invariantErrors++;
      else r.exceptions++;
      fail({ ...where, kind: invariant ? 'invariant' : 'exception', message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    }
    if ((i + 1) % 1000 === 0) opts.onProgress?.(i + 1);
  }
  return r;
}

export const fuzzClean = (r: FuzzResult): boolean => r.exceptions + r.invariantErrors + r.replayMismatches === 0;

export function fuzzReport(r: FuzzResult, run: { date: string; tag?: string | undefined; args: readonly string[]; wallMs: number }): Report {
  return {
    command: 'fuzz',
    date: run.date,
    tag: run.tag,
    args: run.args,
    meta: [
      ['battles', fmtCount(r.battles)],
      ['exceptions', String(r.exceptions)],
      ['invariant errors', String(r.invariantErrors)],
      ['replay mismatches', String(r.replayMismatches)],
      ['round-cap hits (BattleEnd reason cap)', String(r.capHits)],
      ['verdict', fuzzClean(r) ? 'clean' : 'FAILED'],
      ['wall time', fmtSeconds(run.wallMs)],
    ],
    sections: [
      {
        heading: 'Failures',
        text: r.failures.length === 0 ? ['None.'] : [`The first ${r.failures.length} (reproduce with \`fuzzCase(index)\`).`],
        ...(r.failures.length === 0 ? {} : { table: { columns: ['index', 'a', 'b', 'seed', 'kind', 'message'], rows: r.failures.map((f) => [f.index, f.a, f.b, f.seed, f.kind, f.message]) } }),
      },
    ],
    csv: { columns: ['battles', 'exceptions', 'invariant_errors', 'replay_mismatches', 'cap_hits'], rows: [[r.battles, r.exceptions, r.invariantErrors, r.replayMismatches, r.capHits]] },
  };
}

export async function fuzzCommand(args: string[], ctx: CommandContext, engine: FuzzEngine = ENGINE): Promise<number> {
  const p = parseArgs(args, FUZZ);
  const battles = num(p, 'battles', 500);
  const t0 = ctx.now();
  const r = runFuzz(battles, { engine, onProgress: (done) => ctx.progress(`fuzz: ${fmtCount(done)}/${fmtCount(battles)}`) });
  const paths = writeReport(fuzzReport(r, { date: ctx.date, tag: tag(p, 'tag'), args, wallMs: ctx.now() - t0 }), ctx.outDir);
  ctx.progress(`wrote ${paths.md} and ${paths.csv}`);
  return fuzzClean(r) ? 0 : 1;
}
