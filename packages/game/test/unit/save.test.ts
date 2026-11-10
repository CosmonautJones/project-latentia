import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@latentia/engine';
import type { Progress } from '../../src/flow/flow.js';
import { NO_TELEMETRY, type FightReport } from '../../src/flow/telemetry.js';
import {
  clearSave,
  loadSave,
  parseSave,
  SAVE_KEY,
  SCHEMA_VERSION,
  writeSave,
  type KeyValueStorage,
  MIGRATIONS,
  type Migration,
} from '../../src/save/save.js';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError: storage disabled');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError: storage disabled');
  },
};

/** A v1/v2 save's progress: the journey fields only. */
const oldProgress = { step: 'cardTutorial', starter: 'blitzr', distill: 'spinUp', tutorialCardId: null } as const;
/** What v3 adds when it upgrades one: no trainer result yet, and no telemetry. */
const upgraded: Progress = { ...oldProgress, trainerBeaten: false, lastFight: null, telemetry: NO_TELEMETRY };
const progress = upgraded;
const fight: FightReport = { battle: 'trainer', outcome: 'lose', rounds: 5, moves: 11, cardsFired: 5, cardId: 'tutorial.c', kept: ['Tokenibble kept using Low Latency.'] };
const debrief: Progress = {
  step: 'debrief',
  starter: 'blitzr',
  distill: 'spinUp',
  tutorialCardId: 'tutorial.c',
  trainerBeaten: false,
  lastFight: fight,
  telemetry: { ...NO_TELEMETRY, losses: 1, turns: 5, moves: 11, cardsFired: 5, fights: [{ battle: 'trainer', outcome: 'lose', rounds: 5, moves: 11, cardsFired: 5, cardId: 'tutorial.c' }] },
};
const v3 = (p: unknown) => JSON.stringify({ schemaVersion: 3, engineVersion: ENGINE_VERSION, progress: p, hintsSeen: [] });

describe('save: constants', () => {
  it('uses the v0 key and schema version 3 (v2 added the hints seen; v3 the trainer result and the telemetry)', () => {
    expect(SAVE_KEY).toBe('latentia.save.v0');
    expect(SCHEMA_VERSION).toBe(3);
  });
});

describe('save: round trip', () => {
  it('writes versioned JSON under the key and reads the same progress and hints back', () => {
    const store = new MemoryStorage();
    expect(writeSave(store, progress, ['battle.prompt'])).toBe(true);
    const raw = JSON.parse(store.getItem(SAVE_KEY) as string) as Record<string, unknown>;
    expect(raw['schemaVersion']).toBe(3);
    expect(raw['engineVersion']).toBe(ENGINE_VERSION);
    expect(loadSave(store)).toEqual({ status: 'ok', save: { schemaVersion: 3, engineVersion: ENGINE_VERSION, progress, hintsSeen: ['battle.prompt'] } });
    writeSave(store, progress);
    expect(loadSave(store)).toMatchObject({ save: { hintsSeen: [] } });
  });

  it('a debrief with its fight and telemetry round-trips', () => {
    const store = new MemoryStorage();
    writeSave(store, debrief);
    expect(loadSave(store)).toMatchObject({ status: 'ok', save: { progress: debrief } });
  });

  it('a v1 save (before hints) upgrades through v2 to v3', () => {
    const v1 = JSON.stringify({ schemaVersion: 1, engineVersion: '0.3.0', progress: oldProgress });
    expect(parseSave(v1)).toEqual({ status: 'ok', save: { schemaVersion: 3, engineVersion: '0.3.0', progress: upgraded, hintsSeen: [] } });
  });

  it('a v2 save upgrades to v3 with no trainer result and no telemetry; a v2 end card counts the trainer as beaten', () => {
    const v2 = (p: unknown) => JSON.stringify({ schemaVersion: 2, engineVersion: '0.3.0', progress: p, hintsSeen: ['battle.why'] });
    expect(parseSave(v2(oldProgress))).toEqual({ status: 'ok', save: { schemaVersion: 3, engineVersion: '0.3.0', progress: upgraded, hintsSeen: ['battle.why'] } });
    const end = { step: 'end', starter: 'sagelet', distill: 'graft', tutorialCardId: null };
    expect(parseSave(v2(end))).toMatchObject({ status: 'ok', save: { progress: { step: 'end', trainerBeaten: true, lastFight: null, telemetry: NO_TELEMETRY } } });
  });

  it('an empty store loads as empty', () => {
    expect(loadSave(new MemoryStorage())).toEqual({ status: 'empty' });
  });

  it('clearSave removes it', () => {
    const store = new MemoryStorage();
    writeSave(store, progress);
    clearSave(store);
    expect(loadSave(store)).toEqual({ status: 'empty' });
  });
});

describe('save: corrupt data starts fresh and never throws', () => {
  const bad: Array<[string, string]> = [
    ['not JSON', '{"schemaVersion":1,'],
    ['JSON null', 'null'],
    ['an array', '[1,2,3]'],
    ['no schemaVersion', JSON.stringify({ progress })],
    ['schemaVersion is a string', JSON.stringify({ schemaVersion: '1', engineVersion: ENGINE_VERSION, progress })],
    ['missing progress', JSON.stringify({ schemaVersion: 1, engineVersion: ENGINE_VERSION })],
    ['unknown step', JSON.stringify({ schemaVersion: 1, engineVersion: ENGINE_VERSION, progress: { ...progress, step: 'gym' } })],
    ['unknown starter', JSON.stringify({ schemaVersion: 1, engineVersion: ENGINE_VERSION, progress: { ...progress, starter: 'not-a-starter' } })],
    ['inconsistent progress', JSON.stringify({ schemaVersion: 1, engineVersion: ENGINE_VERSION, progress: { ...progress, distill: null } })],
    ['engineVersion not a string', JSON.stringify({ schemaVersion: 1, engineVersion: 3, progress })],
    ['hintsSeen not an array', JSON.stringify({ schemaVersion: 2, engineVersion: ENGINE_VERSION, progress, hintsSeen: 'all' })],
    ['hintsSeen with a non-string', JSON.stringify({ schemaVersion: 2, engineVersion: ENGINE_VERSION, progress, hintsSeen: ['a', 3] })],
    ['trainerBeaten not a boolean', v3({ ...debrief, trainerBeaten: 'yes' })],
    ['a debrief without its fight', v3({ ...debrief, lastFight: null })],
    ['a fight with an unknown outcome', v3({ ...debrief, lastFight: { ...fight, outcome: 'meh' } })],
    ['a fight with negative rounds', v3({ ...debrief, lastFight: { ...fight, rounds: -1 } })],
    ['a fight whose lines are not strings', v3({ ...debrief, lastFight: { ...fight, kept: [1] } })],
    ['telemetry missing', v3({ ...debrief, telemetry: undefined })],
    ['telemetry with a fractional count', v3({ ...debrief, telemetry: { ...debrief.telemetry, swaps: 0.5 } })],
    ['a logged fight from an unknown battle', v3({ ...debrief, telemetry: { ...debrief.telemetry, fights: [{ ...fight, battle: 'gym' }] } })],
  ];
  it.each(bad)('%s', (_name, text) => {
    const store = new MemoryStorage();
    store.setItem(SAVE_KEY, text);
    const r = loadSave(store);
    expect(r.status).toBe('corrupt');
  });

  it('storage that throws (private mode, disabled storage) reads as empty and writes report failure', () => {
    expect(loadSave(throwing)).toEqual({ status: 'empty' });
    expect(writeSave(throwing, progress)).toBe(false);
    expect(() => clearSave(throwing)).not.toThrow();
  });
});

describe('save: versions and migrations', () => {
  it('a save from a newer schema is reported unsupported and is not migrated', () => {
    const r = parseSave(JSON.stringify({ schemaVersion: 7, engineVersion: '9.0.0', progress }));
    expect(r).toEqual({ status: 'unsupported', version: 7 });
  });

  it('a non-integer version is corrupt', () => {
    expect(parseSave(JSON.stringify({ schemaVersion: 1.5, progress })).status).toBe('corrupt');
  });

  it('an old version with no migration path is unsupported', () => {
    expect(parseSave(JSON.stringify({ schemaVersion: 0, step: 'lab' }))).toEqual({ status: 'unsupported', version: 0 });
    expect(parseSave(JSON.stringify({ schemaVersion: -1, progress }))).toEqual({ status: 'unsupported', version: -1 });
  });

  it('the migration hook upgrades one version at a time, in order', () => {
    // Hypothetical history: v-1 stored a flat `stage`, v0 renamed it to `step`, v1 nested it under `progress`.
    const calls: number[] = [];
    const migrations: Migration[] = [
      {
        from: 0,
        migrate: (raw) => {
          calls.push(0);
          const r = raw as { step: string };
          return { schemaVersion: 1, engineVersion: 'unknown', progress: { step: r.step, starter: null, distill: null, tutorialCardId: null } };
        },
      },
      {
        from: -1,
        migrate: (raw) => {
          calls.push(-1);
          return { schemaVersion: 0, step: (raw as { stage: string }).stage };
        },
      },
    ];
    const r = parseSave(JSON.stringify({ schemaVersion: -1, stage: 'lab' }), [...migrations, ...MIGRATIONS]);
    expect(calls).toEqual([-1, 0]);
    expect(r).toEqual({
      status: 'ok',
      save: { schemaVersion: 3, engineVersion: 'unknown', progress: { step: 'lab', starter: null, distill: null, tutorialCardId: null, trainerBeaten: false, lastFight: null, telemetry: NO_TELEMETRY }, hintsSeen: [] },
    });
  });

  it('a migration that throws or skips a version leaves the save corrupt rather than crashing', () => {
    const throws: Migration[] = [{ from: 0, migrate: () => { throw new Error('boom'); } }];
    expect(parseSave(JSON.stringify({ schemaVersion: 0 }), throws).status).toBe('corrupt');
    const stalls: Migration[] = [{ from: 0, migrate: (raw) => raw }];
    expect(parseSave(JSON.stringify({ schemaVersion: 0 }), stalls).status).toBe('corrupt');
  });
});
