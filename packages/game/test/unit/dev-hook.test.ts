import { describe, expect, it } from 'vitest';
import { shouldExposeHook } from '../../src/dev/hook.js';

describe('shouldExposeHook', () => {
  it('is on in dev and in the test build, off in production', () => {
    expect(shouldExposeHook({ DEV: true, MODE: 'development' })).toBe(true);
    expect(shouldExposeHook({ DEV: false, MODE: 'test' })).toBe(true);
    expect(shouldExposeHook({ DEV: false, MODE: 'production' })).toBe(false);
  });
});
