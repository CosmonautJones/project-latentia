import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@latentia/engine';
import type { Progress } from '../../src/flow/flow.js';
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

const progress: Progress = { step: 'cardTutorial', starter: 'blitzr', distill: 'spinUp', tutorialCardId: null };

describe('save: constants', () => {
  it('uses the v0 key and schema version 2 (v2 added the first-time hints seen)', () => {
    expect(SAVE_KEY).toBe('latentia.save.v0');
    expect(SCHEMA_VERSION).toBe(2);
  });
});

describe('save: round trip', () => {
  it('writes versioned JSON under the key and reads the same progress and hints back', () => {
    const store = new MemoryStorage();
    expect(writeSave(store, progress, ['battle.prompt'])).toBe(true);
    const raw = JSON.parse(store.getItem(SAVE_KEY) as string) as Record<string, unknown>;
    expect(raw['schemaVersion']).toBe(2);
    expect(raw['engineVersion']).toBe(ENGINE_VERSION);
    expect(loadSave(store)).toEqual({ status: 'ok', save: { schemaVersion: 2, engineVersion: ENGINE_VERSION, progress, hintsSeen: ['battle.prompt'] } });
    writeSave(store, progress);
    expect(loadSave(store)).toMatchObject({ save: { hintsSeen: [] } });
  });

  it('a v1 save (before hints) upgrades to v2 with no hints seen', () => {
    const v1 = JSON.stringify({ schemaVersion: 1, engineVersion: '0.3.0', progress });
    expect(parseSave(v1)).toEqual({ status: 'ok', save: { schemaVersion: 2, engineVersion: '0.3.0', progress, hintsSeen: [] } });
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
      save: { schemaVersion: 2, engineVersion: 'unknown', progress: { step: 'lab', starter: null, distill: null, tutorialCardId: null }, hintsSeen: [] },
    });
  });

  it('a migration that throws or skips a version leaves the save corrupt rather than crashing', () => {
    const throws: Migration[] = [{ from: 0, migrate: () => { throw new Error('boom'); } }];
    expect(parseSave(JSON.stringify({ schemaVersion: 0 }), throws).status).toBe('corrupt');
    const stalls: Migration[] = [{ from: 0, migrate: (raw) => raw }];
    expect(parseSave(JSON.stringify({ schemaVersion: 0 }), stalls).status).toBe('corrupt');
  });
});
