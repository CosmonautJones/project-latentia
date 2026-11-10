import { fnv1a64Hex } from '@latentia/engine';
import { ARCHETYPES } from './archetypes/index.js';
import { targetSetups } from './target-setups.js';
import { TARGETS } from './targets.js';

// The content fingerprint every report records (Ruling 143 I5): FNV-1a 64 over the UTF-8 canonical JSON of the
// ARCHETYPES, the TARGETS table and every target setup object. Two reports with the same fingerprint, engine version
// and seed scale ran on the same sim content. Engine content (species, moves, the chart) is pinned by the engine
// version and the git SHA beside it.

/** JSON with every object's keys sorted by UTF-16 code unit and no whitespace; undefined object members are dropped, as JSON.stringify does. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonicalJson(x))).join(',')}]`;
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonicalJson(x)}`).join(',')}}`;
}

let cached: string | undefined;

/** The fingerprint of the sim content in this process (computed once: the content is frozen). */
export function contentFingerprint(): string {
  cached ??= fnv1a64Hex(new TextEncoder().encode(canonicalJson({ archetypes: ARCHETYPES, targets: TARGETS, setups: targetSetups() })));
  return cached;
}
