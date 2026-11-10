// The starter triangle (Rulings 136, 146), with the median rounds the targets report does not carry. Since Ruling 146
// the official starter-triangle row is the partnerless one: each starter alone, orchestrator only, with the role-based
// Autopilot deck, the L8 standard grid (its Subagent Slot left empty), 1,000 battles per side assignment pooled = 2,000
// per matchup. This script runs those rows on the targets command's own seed labels, so its points reproduce
// `pnpm sim targets` exactly. Deterministic; no timing.
//
//   pnpm --filter @latentia/sim triangle-solo

import type { StarterId } from '../src/archetypes/index.js';
import { runPooled } from '../src/runner.js';
import { median, rate, verdict, wilson95 } from '../src/stats.js';
import { starterSide, TRIANGLE } from '../src/target-setups.js';
import { targetById } from '../src/targets.js';
import type { Score } from '../src/types.js';

const PER_SIDE = 1000;

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const band = targetById('starter-triangle').band as [number, number];

function row(fav: StarterId, beaten: StarterId, r: { score: Score; rounds: number[] }): string {
  const point = rate(r.score);
  const [lo, hi] = wilson95(r.score.points, r.score.n);
  return `| ${fav} (favoured) vs ${beaten} | ${r.score.n} | ${pct(point)} | [${pct(lo)}, ${pct(hi)}] | ${median(r.rounds)} | ${verdict(point, [lo, hi], band)} |`;
}

const lines = [
  `# Starter triangle (orchestrator only), ${2 * PER_SIDE} battles per matchup`,
  '',
  'Favoured side\'s score, a draw counts 0.5, both side assignments pooled, against the 55–65% band.',
  '',
  '| matchup | battles | point | 95% interval | median rounds | vs band |',
  '|---|---|---|---|---|---|',
];
for (const [fav, beaten] of TRIANGLE) lines.push(row(fav, beaten, runPooled(starterSide(fav), starterSide(beaten), PER_SIDE, `triangle-solo:${fav}:${beaten}`)));
console.log(lines.join('\n'));
