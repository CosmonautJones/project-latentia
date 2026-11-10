// Local save: one versioned JSON document under `latentia.save.v0` (plan "Save"; design bible "saves are
// local-first, versioned"). Loading never throws: corrupt data or a save from a newer build starts fresh.

import { ENGINE_VERSION } from '@latentia/engine';
import { DISTILL_CHOICES, isConsistentProgress, STARTERS, STEPS, type Progress } from '../flow/flow.js';

export const SAVE_KEY = 'latentia.save.v0';
export const SCHEMA_VERSION = 1;

export interface SaveFileV1 {
  readonly schemaVersion: 1;
  readonly engineVersion: string;
  readonly progress: Progress;
}

/** The storage surface the save needs; `window.localStorage` fits, and tests pass an in-memory one. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Upgrades a raw save from schema `from` to `from + 1`. Migrations never rewrite a field in place. */
export interface Migration {
  readonly from: number;
  readonly migrate: (raw: unknown) => unknown;
}

/** Ordered upgrade steps. v1 is the first schema, so there are none yet; v2 adds `{ from: 1, migrate }` here. */
export const MIGRATIONS: readonly Migration[] = [];

export type LoadResult =
  | { readonly status: 'ok'; readonly save: SaveFileV1 }
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt'; readonly reason: string }
  | { readonly status: 'unsupported'; readonly version: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(values: readonly T[], v: unknown): v is T => typeof v === 'string' && (values as readonly string[]).includes(v);
const corrupt = (reason: string): LoadResult => ({ status: 'corrupt', reason });

function parseProgress(v: unknown): Progress | null {
  if (!isRecord(v)) return null;
  const { step, starter, distill, tutorialCardId } = v;
  if (!oneOf(STEPS, step)) return null;
  if (starter !== null && !oneOf(STARTERS, starter)) return null;
  if (distill !== null && !oneOf(DISTILL_CHOICES, distill)) return null;
  if (tutorialCardId !== null && typeof tutorialCardId !== 'string') return null;
  const progress: Progress = { step, starter, distill, tutorialCardId };
  return isConsistentProgress(progress) ? progress : null;
}

function parseV1(raw: Record<string, unknown>): LoadResult {
  if (typeof raw['engineVersion'] !== 'string') return corrupt('engineVersion is not a string');
  const progress = parseProgress(raw['progress']);
  if (!progress) return corrupt('progress is missing or invalid');
  return { status: 'ok', save: { schemaVersion: 1, engineVersion: raw['engineVersion'], progress } };
}

const versionOf = (raw: unknown): number | null =>
  isRecord(raw) && typeof raw['schemaVersion'] === 'number' && Number.isInteger(raw['schemaVersion']) ? raw['schemaVersion'] : null;

/** Parse save text, running `migrations` one version at a time up to SCHEMA_VERSION. */
export function parseSave(text: string, migrations: readonly Migration[] = MIGRATIONS): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return corrupt('not JSON');
  }
  let version = versionOf(raw);
  if (version === null) return corrupt('schemaVersion is missing or not an integer');
  if (version > SCHEMA_VERSION) return { status: 'unsupported', version };

  while (version < SCHEMA_VERSION) {
    const from: number = version;
    const step = migrations.find((m) => m.from === from);
    if (!step) return { status: 'unsupported', version: from };
    try {
      raw = step.migrate(raw);
    } catch {
      return corrupt(`migration from v${from} threw`);
    }
    version = versionOf(raw);
    if (version !== from + 1) return corrupt(`migration from v${from} did not produce v${from + 1}`);
  }
  return parseV1(raw as Record<string, unknown>);
}

export function loadSave(storage: KeyValueStorage): LoadResult {
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { status: 'empty' };
  }
  return text === null ? { status: 'empty' } : parseSave(text);
}

/** Write the progress. Returns false when storage refuses (quota, private mode); the game plays on unsaved. */
export function writeSave(storage: KeyValueStorage, progress: Progress): boolean {
  const file: SaveFileV1 = { schemaVersion: SCHEMA_VERSION, engineVersion: ENGINE_VERSION, progress };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: there is nothing to clear.
  }
}
