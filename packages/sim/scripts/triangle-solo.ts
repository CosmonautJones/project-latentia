// The partnerless starter-triangle diagnostic (Ruling 136, Task C5). Not a target row.
//
// The official starter-triangle target (targets.ts) gives every starter its bundled Tokenibble, a Speed-type intern,
// so the partner's type favours whoever Speed beats. This script separates the type triangle from that confound: each
// starter fights alone, orchestrator only, with everything else exactly as the official row. That means the same
// role-based Autopilot deck, the same L8 standard grid (its Subagent Slot left empty, so headroom is unchanged), the
// same temperature, 1,000 battles per side assignment pooled = 2,000 per matchup. It prints both rows as Markdown:
// the official row (re-run on the targets command's own seed labels, so it reproduces `pnpm sim targets` exactly)
// and the solo row. Deterministic; no timing.
//
//   pnpm --filter @latentia/sim triangle-solo

import { validateSetup, type PlacedPiece } from '@latentia/engine';
import type { StarterId } from '../src/archetypes/index.js';
import { runPooled } from '../src/runner.js';
import { median, rate, verdict, wilson95 } from '../src/stats.js';
import { starterSide, TRIANGLE } from '../src/target-setups.js';
import { targetById } from '../src/targets.js';
import type { Archetype, Score } from '../src/types.js';

const PER_SIDE = 1000;

/** The official starter side with its partner removed: no active subagent, and the grid's slot unbound (left empty). */
function soloSide(s: StarterId): Archetype {
  const { id, side } = starterSide(s);
  if (side.grid === null) throw new Error(`${id} has no grid`);
  const unbind = (p: PlacedPiece): PlacedPiece => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'subagentId')) as PlacedPiece;
  const pieces = side.grid.pieces.map((p) => (p.subagentId === undefined ? p : unbind(p)));
  return { id: `${id}-solo`, side: { ...side, active: [], bench: [], grid: { ...side.grid, pieces } } };
}

/** The solo pairing, checked with the engine's own validation first (an invalid diagnostic must not run). */
function soloPair(fav: StarterId, beaten: StarterId): [Archetype, Archetype] {
  const [x, y] = [soloSide(fav), soloSide(beaten)];
  const v = validateSetup({ a: { ...x.side, opponentId: y.id }, b: { ...y.side, opponentId: x.id }, kind: 'trainer' });
  if (!v.ok) throw new Error(`${x.id} vs ${y.id} is invalid: ${JSON.stringify(v.errors)}`);
  return [x, y];
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const band = targetById('starter-triangle').band as [number, number];

function row(setup: string, fav: StarterId, beaten: StarterId, r: { score: Score; rounds: number[] }): string {
  const point = rate(r.score);
  const [lo, hi] = wilson95(r.score.points, r.score.n);
  return `| ${setup} | ${fav} (favoured) vs ${beaten} | ${r.score.n} | ${pct(point)} | [${pct(lo)}, ${pct(hi)}] | ${median(r.rounds)} | ${verdict(point, [lo, hi], band)} |`;
}

const lines = [
  `# Starter triangle: official (with Tokenibble) vs solo (orchestrator only), ${2 * PER_SIDE} battles per matchup`,
  '',
  'Favoured side\'s score, a draw counts 0.5, both side assignments pooled. The band (55–65%) is shown for reading only: the solo row is a diagnostic, not a target.',
  '',
  '| setup | matchup | battles | point | 95% interval | median rounds | vs band |',
  '|---|---|---|---|---|---|---|',
];
for (const [fav, beaten] of TRIANGLE) {
  lines.push(row('official', fav, beaten, runPooled(starterSide(fav), starterSide(beaten), PER_SIDE, `targets:starter-triangle:${fav}:${beaten}`)));
  lines.push(row('solo', fav, beaten, runPooled(...soloPair(fav, beaten), PER_SIDE, `triangle-solo:${fav}:${beaten}`)));
}
console.log(lines.join('\n'));
