// Records the golden battles: every scenario in test/golden/scenarios.ts is run through simulate and
// written to test/golden/<name>.json as { name, log, expectedHash, rounds, winner }.
//
//   pnpm golden:record            writes missing goldens; never touches an existing file
//   pnpm golden:record --update   rewrites every golden (after an intended event-stream change)
//
// Without --update an existing golden that would change is reported as stale and the script exits 1.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simulate } from '../src/battle/simulate.js';
import { SCENARIOS } from '../test/golden/scenarios.js';
import { scriptedSource } from '../test/golden/script.js';

const update = process.argv.slice(2).includes('--update');
const dir = fileURLToPath(new URL('../test/golden/', import.meta.url));

type Row = { name: string; rounds: number; winner: string; hash: string; status: string };
const rows: Row[] = [];
let stale = 0;

for (const s of SCENARIOS) {
  const r = simulate(s.setup, s.seed, scriptedSource(s.scripts));
  const text = `${JSON.stringify({ name: s.name, log: r.log, expectedHash: r.hash, rounds: r.rounds, winner: r.winner }, null, 2)}\n`;
  const path = `${dir}${s.name}.json`;
  let status: string;
  if (!existsSync(path)) {
    writeFileSync(path, text);
    status = 'written';
  } else if (readFileSync(path, 'utf8') === text) {
    status = 'unchanged';
  } else if (update) {
    writeFileSync(path, text);
    status = 'UPDATED';
  } else {
    stale++;
    status = 'STALE (not overwritten; use --update)';
  }
  rows.push({ name: s.name, rounds: r.rounds, winner: r.winner, hash: r.hash, status });
}

const width = Math.max(...rows.map((r) => r.name.length));
console.log(`${'name'.padEnd(width)}  rounds  winner  hash              status`);
for (const r of rows) console.log(`${r.name.padEnd(width)}  ${String(r.rounds).padStart(6)}  ${r.winner.padEnd(6)}  ${r.hash}  ${r.status}`);

const names = new Set(SCENARIOS.map((s) => s.name));
const orphans = readdirSync(dir).filter((f) => f.endsWith('.json') && !names.has(f.slice(0, -'.json'.length)));
for (const f of orphans) console.log(`orphan golden with no scenario: ${f} (delete it by hand)`);

if (stale > 0) {
  console.error(`${stale} golden(s) would change; re-run with --update if the event-stream change is intended.`);
  process.exitCode = 1;
}
if (orphans.length > 0) process.exitCode = 1;
