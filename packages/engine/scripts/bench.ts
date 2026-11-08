// Micro-benchmark (spec §2 criterion 7, §8): mean wall time per simulated battle over a fixed set of
// 2,000 player-commanded battles; exits 1 above 1.2 ms. Battle i uses the golden scenarios' setups
// (a fixed list of legal setups) in turn, seed seedFor(`bench:${i}`), and a scripted source in which
// each orchestrator uses its first usable move at a legal target every round. 200 warm-up battles
// (seeds `bench:warmup:${i}`) run first and are not timed.

import { simulate } from '../src/battle/simulate.js';
import type { CommandSource } from '../src/battle/simulate.js';
import { SCENARIOS, seedFor } from '../test/golden/scenarios.js';
import { firstUsable } from '../test/golden/script.js';

const BATTLES = 2000;
const WARMUP = 200;
const GATE_MS = 1.2;

const SETUPS = SCENARIOS.map((s) => s.setup);

const FIRST_USABLE: CommandSource = { kind: 'scripted', next: (state) => ({ a: firstUsable(state, 'a'), b: firstUsable(state, 'b') }) };

/** Runs `count` battles, battle i seeded seedFor(`${label}${i}`); returns the rounds played (so no work is skipped). */
function run(label: string, count: number): number {
  let rounds = 0;
  for (let i = 0; i < count; i++) {
    const setup = SETUPS[i % SETUPS.length];
    if (setup === undefined) throw new Error('no bench setups');
    rounds += simulate(setup, seedFor(`${label}${i}`), FIRST_USABLE).rounds;
  }
  return rounds;
}

run('bench:warmup:', WARMUP);
const start = performance.now();
const rounds = run('bench:', BATTLES);
const elapsed = performance.now() - start;
const mean = elapsed / BATTLES;

console.log(`bench: ${BATTLES} battles (${SETUPS.length} setups, ${rounds} rounds, ${(rounds / BATTLES).toFixed(1)} rounds/battle) in ${elapsed.toFixed(0)} ms`);
console.log(`bench: mean ${mean.toFixed(3)} ms/battle (gate ${GATE_MS} ms)`);
if (mean > GATE_MS) {
  console.error(`bench: FAIL — mean ${mean.toFixed(3)} ms/battle is above the ${GATE_MS} ms gate`);
  process.exitCode = 1;
}
