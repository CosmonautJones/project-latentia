// `pnpm --filter @latentia/game measure-loop [seeds]`: the committed core-loop measurement (plan step 8). Runs the
// naive player (scripts/loop-balance.ts) against Bootcamp Grad over `seeds` trainer seeds (default 200) per starter,
// for each tutorial preset and the graft path, then the counterfactuals: the same with one knob of the Grad changed.
// Prints win rates pooled over the starters, then per starter (sagelet / blitzr / forkling), and whether the targets
// hold: the bad preset loses >= 60%, the good preset wins >= 70%, situational lands in between (at least 5 points from
// each), graft wins >= 50%.

import type { Card, Condition, Deck, Temperature } from '@latentia/engine';
import { BOOTCAMP_GRAD, type TrainerTuning } from '../src/content/trainers.js';
import { STARTERS } from '../src/flow/flow.js';
import { measureGraftHint, naiveCommand, measureLoop, measureRival, measureWild, pooledWinRate, readsTelegraph, telegraphCommand, type LoopRow, type Player, type ReadOptions } from './loop-balance.js';

const seeds = Number(process.argv[2] ?? 200);
if (!Number.isSafeInteger(seeds) || seeds < 1) throw new Error(`seeds must be a positive integer, got ${process.argv[2]}`);

/** "In between" means clearly so: at least 5 points from either end. */
const BETWEEN_MARGIN = 0.05;
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;
const rate = (rows: readonly LoopRow[], path: LoopRow['path']): number => {
  const row = rows.find((r) => r.path === path);
  if (!row) throw new Error(`no ${path} row`);
  return pooledWinRate(row);
};

/** Whether a measurement meets the loop's targets. */
function verdict(rows: readonly LoopRow[]): string {
  const [bad, situational, good, graft] = (['bad', 'situational', 'good', 'graft'] as const).map((p) => rate(rows, p));
  const checks = [
    [`bad loses >= 60%`, 1 - (bad ?? 1) >= 0.6],
    [`good wins >= 70%`, (good ?? 0) >= 0.7],
    [`situational between`, (bad ?? 1) + BETWEEN_MARGIN <= (situational ?? 0) && (situational ?? 1) + BETWEEN_MARGIN <= (good ?? 0)],
    [`graft wins >= 50%`, (graft ?? 0) >= 0.5],
  ] as const;
  return checks.map(([name, ok]) => `${ok ? 'ok' : 'FAIL'} ${name}`).join(', ');
}

function report(name: string, grad: TrainerTuning): void {
  const rows = measureLoop(seeds, grad);
  const cells = rows.map((r) => `${r.path} ${pct(pooledWinRate(r))} (${STARTERS.map((s) => Math.round((100 * r.wins[s]) / r.seeds)).join('/')})`);
  console.log(`${name}\n  ${cells.join(' | ')}\n  ${verdict(rows)}`);
}

const retarget = (d: Deck, from: Card['target'], to: Card['target']): Deck => {
  const aim = (c: Card): Card => (c.target === from ? { ...c, target: to } : c);
  return { default: aim(d.default), cards: d.cards.map(aim) };
};
const without = (d: Deck, id: string): Deck => ({ ...d, cards: d.cards.filter((c) => c.id !== id) });
const atTemp = (temperature: Temperature): TrainerTuning => ({ ...BOOTCAMP_GRAD, temperature });
const levels = (patch: Partial<TrainerTuning['level']>): TrainerTuning => ({ ...BOOTCAMP_GRAD, level: { ...BOOTCAMP_GRAD.level, ...patch } });

const c = (id: string, subject: Card['subject'], condition: Condition, move: string, target: Card['target']): Card => ({ id, subject, condition, move, target });
const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
/** P2's Bootcamp Grad (L6, T2), for the record: hype once, Accept All while you're healthy, Segfault once you're hurt. */
const P2_GRAD: TrainerTuning = {
  level: { sagelet: 6, blitzr: 6, forkling: 6 },
  temperature: 2,
  deck: {
    default: c('default', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
    cards: [
      c('tidy', 'self', { category: 'contextFill', op: 'atLeast', pct: 75 }, 'compact', 'self'),
      c('hype', 'self', { category: 'turn', op: 'below', round: 2 }, 'hype-train', 'self'),
      c('acceptall', 'foe', { category: 'hp', op: 'atLeast', pct: 50 }, 'accept-all', 'lowestHpFoe'),
      c('segfault', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'segfault', 'lowestHpFoe'),
    ],
  },
};

const kip = measureRival(seeds);
const kipAll = STARTERS.reduce((n, s) => n + kip[s], 0) / (seeds * STARTERS.length);
console.log(`Kip (rival, for reference): naive wins ${pct(kipAll)} (${STARTERS.map((s) => Math.round((100 * kip[s]) / seeds)).join('/')})\n`);
console.log(`Bootcamp Grad core loop: naive player, ${seeds} seeds per starter (${seeds * STARTERS.length} fights a row). Win %: pooled (sagelet/blitzr/forkling).\n`);
report('CHOSEN', BOOTCAMP_GRAD);
report('counterfactual: T1', atTemp(1));
report('counterfactual: T2', atTemp(2));
report('counterfactual: Forkling L7 (all L7)', levels({ forkling: 7 }));
report('counterfactual: Blitzr L6', levels({ blitzr: 6 }));
report('counterfactual: all L6', levels({ sagelet: 6, blitzr: 6, forkling: 6 }));
report('counterfactual: no Token Burst answer (drop week3)', { ...BOOTCAMP_GRAD, deck: without(BOOTCAMP_GRAD.deck, 'week3') });
report('counterfactual: no buff answer (drop outdo)', { ...BOOTCAMP_GRAD, deck: without(BOOTCAMP_GRAD.deck, 'outdo') });
report('counterfactual: aims at the lowest-HP foe', { ...BOOTCAMP_GRAD, deck: retarget(BOOTCAMP_GRAD.deck, 'highestAtkFoe', 'lowestHpFoe') });
report("counterfactual: P2's Grad", P2_GRAD);

const hint = measureGraftHint(seeds);
console.log(`\nGraft path, naive vs following the loss hint (GRAFT_HINTS): ${STARTERS.map((s) => `${s} ${pct(hint[s].naive / seeds)} -> ${pct(hint[s].hinted / seeds)}`).join(', ')}`);

// Plan v0.1 Q2: the player who reads the telegraph (scripts/loop-balance.ts telegraphCommand) against the naive one.
const perStarter = (w: Readonly<Record<string, number>>): string => STARTERS.map((st) => Math.round((100 * (w[st] ?? 0)) / seeds)).join('/');
const pooled = (w: Readonly<Record<string, number>>): string => pct(STARTERS.reduce((n, st) => n + (w[st] ?? 0), 0) / (seeds * STARTERS.length));
function compare(name: string, player: Player): void {
  const rival = measureRival(seeds, player);
  const wild = measureWild(seeds, player);
  const rows = measureLoop(seeds, BOOTCAMP_GRAD, player);
  const cells = rows.map((r) => `${r.path} ${pct(pooledWinRate(r))} (${STARTERS.map((st) => Math.round((100 * r.wins[st]) / r.seeds)).join('/')})`);
  console.log(`${name}\n  Kip ${pooled(rival)} (${perStarter(rival)}) | wild ${pooled(wild)} (${perStarter(wild)})\n  Grad: ${cells.join(' | ')}`);
}
console.log('\nReads the telegraph (Guardrail when a telegraphed Attack ~N >= 25% of its HP), same seeds:');
compare("naive (for comparison)", naiveCommand);
compare('READS THE TELEGRAPH (of its full HP bar, never guards twice running)', telegraphCommand);
const variant = (o: ReadOptions): Player => (s) => readsTelegraph(s, o);
compare('  variant: of its HP now, never twice running', variant({ of: 'hp', twiceRunning: false }));
compare('  variant: of its full bar, guards again and again', variant({ of: 'maxHp', twiceRunning: true }));
compare('  variant: of its HP now, guards again and again (the most literal reading)', variant({ of: 'hp', twiceRunning: true }));
