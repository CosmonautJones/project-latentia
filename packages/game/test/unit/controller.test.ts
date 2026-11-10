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
    expect(scenes.at(-1)).toBe('Lab');
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
});
