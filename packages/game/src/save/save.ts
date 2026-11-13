// Local save: one versioned JSON document under `latentia.save.v0` (plan "Save"; design bible "saves are
// local-first, versioned"). Loading never throws: corrupt data or a save from a newer build starts fresh.

import { ENGINE_VERSION } from '@latentia/engine';
import type { Progress } from '../flow/flow.js';
import { NO_TELEMETRY } from '../flow/telemetry.js';
import { isRecord, parseProgress } from './progress-shape.js';

export const SAVE_KEY = 'latentia.save.v0';
export const SCHEMA_VERSION = 4;

/** What the save has unlocked (v4). `temperature` shows the battle's temperature dial (ruling V12); nothing sets it in v0.1. */
export interface Unlocks {
  readonly temperature: boolean;
}

export const NO_UNLOCKS: Unlocks = Object.freeze({ temperature: false });

export interface SaveFile {
  readonly schemaVersion: 4;
  readonly engineVersion: string;
  readonly progress: Progress;
  /** Ids of the one-time first-encounter hints already shown (v2). */
  readonly hintsSeen: readonly string[];
  /** Systems the player has unlocked (v4). */
  readonly unlocks: Unlocks;
}

/** The storage surface the save needs; `window.localStorage` fits, and tests pass an in-memory one. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Upgrades a raw save from schema `from` to `from + 1`. Migrations never rewrite a field in place. */
export interface Migration {
  readonly from: number;
  readonly migrate: (raw: unknown) => unknown;
}

/** v2 → v3: the progress gains the trainer result and the telemetry. A v2 save at the end card had beaten the Grad. */
function addTrainerResult(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw['progress'])) return raw;
  const progress = raw['progress'];
  return { ...raw, schemaVersion: 3, progress: { ...progress, trainerBeaten: progress['step'] === 'end', lastFight: null, telemetry: NO_TELEMETRY } };
}

/** Ordered upgrade steps. v1 → v2 adds `hintsSeen` (no hints seen yet); v2 → v3 adds the trainer result and telemetry; v3 → v4 the unlocks (nothing unlocked). */
export const MIGRATIONS: readonly Migration[] = [
  { from: 1, migrate: (raw) => (isRecord(raw) ? { ...raw, schemaVersion: 2, hintsSeen: [] } : raw) },
  { from: 2, migrate: addTrainerResult },
  { from: 3, migrate: (raw) => (isRecord(raw) ? { ...raw, schemaVersion: 4, unlocks: { ...NO_UNLOCKS } } : raw) },
];

export type LoadResult =
  | { readonly status: 'ok'; readonly save: SaveFile }
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt'; readonly reason: string }
  | { readonly status: 'unsupported'; readonly version: number };

const corrupt = (reason: string): LoadResult => ({ status: 'corrupt', reason });

function parseCurrent(raw: Record<string, unknown>): LoadResult {
  if (typeof raw['engineVersion'] !== 'string') return corrupt('engineVersion is not a string');
  const progress = parseProgress(raw['progress']);
  if (!progress) return corrupt('progress is missing or invalid');
  const hints = raw['hintsSeen'];
  if (!Array.isArray(hints) || !hints.every((h) => typeof h === 'string')) return corrupt('hintsSeen is not a list of ids');
  const unlocks = raw['unlocks'];
  if (!isRecord(unlocks) || typeof unlocks['temperature'] !== 'boolean') return corrupt('unlocks is missing or invalid');
  return { status: 'ok', save: { schemaVersion: 4, engineVersion: raw['engineVersion'], progress, hintsSeen: [...(hints as string[])], unlocks: { temperature: unlocks['temperature'] } } };
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
  return parseCurrent(raw as Record<string, unknown>);
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

/** Write the progress, hints and unlocks. Returns false when storage refuses (quota, private mode); the game plays on unsaved. */
export function writeSave(storage: KeyValueStorage, progress: Progress, hintsSeen: readonly string[] = [], unlocks: Unlocks = NO_UNLOCKS): boolean {
  const file: SaveFile = { schemaVersion: SCHEMA_VERSION, engineVersion: ENGINE_VERSION, progress, hintsSeen, unlocks };
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
