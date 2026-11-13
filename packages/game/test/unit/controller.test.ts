import { describe, expect, it } from 'vitest';
import { FlowController } from '../../src/flow/controller.js';
import { loadSave, SAVE_KEY, type KeyValueStorage } from '../../src/save/save.js';

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

const setup = () => {
  const storage = new MemoryStorage();
  const scenes: string[] = [];
  const flow = new FlowController(storage, (scene) => scenes.push(scene));
  return { storage, scenes, flow };
};

describe('FlowController', () => {
  it('unlocks survive a New Game after a reload (read at construction, not only on Continue)', () => {
    const storage = new MemoryStorage();
    const first = new FlowController(storage, () => {});
    first.start();
    first.send({ type: 'newGame' });
    const raw = JSON.parse(storage.data.get(SAVE_KEY) ?? '{}') as Record<string, unknown>;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...raw, unlocks: { temperature: true } }));
    // A reload: a fresh controller, then NEW GAME without Continue.
    const reloaded = new FlowController(storage, () => {});
    expect(reloaded.unlocks.temperature).toBe(true);
    reloaded.start();
    reloaded.send({ type: 'newGame' });
    const after = loadSave(storage);
    expect(after.status === 'ok' && after.save.unlocks.temperature).toBe(true);
  });

  it('start() shows the title without writing a save', () => {
    const { storage, scenes, flow } = setup();
    flow.start();
    expect(scenes).toEqual(['Title']);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it('each accepted event switches to the step scene and saves the step', () => {
    const { storage, scenes, flow } = setup();
    flow.start();
    expect(flow.send({ type: 'newGame' })).toBe(true);
    expect(scenes.at(-1)).toBe('Overworld');
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'lab' } } });
    flow.send({ type: 'starterPicked', starter: 'sagelet' });
    expect(scenes.at(-1)).toBe('Battle');
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'rival', starter: 'sagelet' } } });
  });

  it('a rejected event changes nothing and returns false', () => {
    const { scenes, flow } = setup();
    flow.start();
    expect(flow.send({ type: 'battleWon' })).toBe(false);
    expect(flow.state.step).toBe('title');
    expect(scenes).toEqual(['Title']);
  });

  it('losing restarts the battle scene', () => {
    const { scenes, flow } = setup();
    flow.start();
    flow.send({ type: 'newGame' });
    flow.send({ type: 'starterPicked', starter: 'blitzr' });
    flow.send({ type: 'battleLost' });
    expect(scenes.slice(-2)).toEqual(['Battle', 'Battle']);
    expect(flow.state.attempt).toBe(1);
  });

  it('new game replaces an old save; back to title keeps the save for Continue', () => {
    const { storage, flow } = setup();
    flow.start();
    flow.send({ type: 'newGame' });
    flow.send({ type: 'starterPicked', starter: 'forkling' });
    flow.send({ type: 'backToTitle' });
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'rival' } } });
    flow.send({ type: 'newGame' });
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'lab', starter: null } } });
  });

  it('notifies listeners with each new state', () => {
    const { flow } = setup();
    const steps: string[] = [];
    flow.onChange((s) => steps.push(s.step));
    flow.start();
    flow.send({ type: 'newGame' });
    expect(steps).toEqual(['title', 'lab']);
  });

  it('first-time hints are remembered in the save without switching scenes, and newGame/continue reset/restore them', () => {
    const { storage, scenes, flow } = setup();
    flow.start();
    flow.markHintSeen('early');
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    flow.send({ type: 'newGame' });
    expect(flow.hasSeenHint('early')).toBe(false);
    flow.send({ type: 'starterPicked', starter: 'sagelet' });
    const switches = scenes.length;
    flow.markHintSeen('battle.prompt');
    flow.markHintSeen('battle.prompt');
    expect(scenes.length).toBe(switches);
    expect(flow.hasSeenHint('battle.prompt')).toBe(true);
    expect(loadSave(storage)).toMatchObject({ save: { progress: { step: 'rival' }, hintsSeen: ['battle.prompt'] } });
    // Kept across step saves.
    flow.send({ type: 'battleWon' });
    expect(loadSave(storage)).toMatchObject({ save: { progress: { step: 'walk' }, hintsSeen: ['battle.prompt'] } });
    // Continue in a new session restores them.
    const again = new FlowController(storage, () => undefined);
    again.start();
    const saved = loadSave(storage);
    if (saved.status !== 'ok') throw new Error('no save');
    again.send({ type: 'continue', progress: saved.save.progress });
    expect(again.hasSeenHint('battle.prompt')).toBe(true);
    again.send({ type: 'backToTitle' });
    again.send({ type: 'newGame' });
    expect(again.hasSeenHint('battle.prompt')).toBe(false);
  });
});
