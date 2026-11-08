// Micro-benchmark (spec §2 criterion 7, §8; Ruling 109): mean wall time per simulated battle; exits 1 above 1.2 ms.
//
// - deck-driven (the gate for Phases B and C): the fixed slice set test/scenarios/slice.ts BENCH_SETUPS — the starter
//   teams against the forest trainers, the grunts and the gym — with both sides on their Autopilot decks
//   ({ kind: 'autopilot' }) and most subagents on decks. Setup s runs SEEDS_PER battles, battle i seeded
//   seedFor(`bench:${name}:${i}`), after WARMUP_PER untimed ones seeded seedFor(`bench:warmup:${name}:${i}`).
// - player-commanded (the Phase A gate, still checked): 2,000 battles over the golden scenarios' setups in turn, battle i
//   seeded seedFor(`bench:${i}`), each orchestrator using its first usable move every round; 200 untimed warm-up battles
//   (seeds `bench:warmup:${i}`) first.

import { simulate } from '../src/battle/simulate.js';
import type { CommandSource } from '../src/battle/simulate.js';
import { SCENARIOS, seedFor } from '../test/golden/scenarios.js';
import { firstUsable } from '../test/golden/script.js';
import { BENCH_SETUPS } from '../test/scenarios/slice.js';

const GATE_MS = 1.2;
const SEEDS_PER = 250;
const WARMUP_PER = 25;
const COMMANDED = 2000;
const COMMANDED_WARMUP = 200;

type Run = { battles: number; rounds: number; ms: number };

/** Each bench setup `per` times, seeds seedFor(`${label}${name}:${i}`), both sides on Autopilot. */
function deckDriven(label: string, per: number): Run {
  const start = performance.now();
  let rounds = 0;
  for (const s of BENCH_SETUPS) for (let i = 0; i < per; i++) rounds += simulate(s.setup, seedFor(`${label}${s.name}:${i}`), { kind: 'autopilot' }).rounds;
  return { battles: BENCH_SETUPS.length * per, rounds, ms: performance.now() - start };
}

const FIRST_USABLE: CommandSource = { kind: 'scripted', next: (state) => ({ a: firstUsable(state, 'a'), b: firstUsable(state, 'b') }) };

/** `count` player-commanded battles over the golden setups in turn, battle i seeded seedFor(`${label}${i}`). */
function commanded(label: string, count: number): Run {
  const start = performance.now();
  let rounds = 0;
  for (let i = 0; i < count; i++) {
    const setup = SCENARIOS[i % SCENARIOS.length]?.setup;
    if (setup === undefined) throw new Error('no bench setups');
    rounds += simulate(setup, seedFor(`${label}${i}`), FIRST_USABLE).rounds;
  }
  return { battles: count, rounds, ms: performance.now() - start };
}

function report(name: string, run: Run, setups: number): boolean {
  const mean = run.ms / run.battles;
  console.log(`bench ${name}: ${run.battles} battles (${setups} setups, ${(run.rounds / run.battles).toFixed(1)} rounds/battle) in ${run.ms.toFixed(0)} ms`);
  console.log(`bench ${name}: mean ${mean.toFixed(3)} ms/battle (gate ${GATE_MS} ms)`);
  if (mean <= GATE_MS) return true;
  console.error(`bench ${name}: FAIL — mean ${mean.toFixed(3)} ms/battle is above the ${GATE_MS} ms gate`);
  return false;
}

deckDriven('bench:warmup:', WARMUP_PER);
const decks = report('deck-driven', deckDriven('bench:', SEEDS_PER), BENCH_SETUPS.length);
commanded('bench:warmup:', COMMANDED_WARMUP);
const players = report('player-commanded', commanded('bench:', COMMANDED), SCENARIOS.length);
if (!decks || !players) process.exitCode = 1;
