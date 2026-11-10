import { defineConfig } from 'vitest/config';

// Unit tests cover the pure modules only (layout, input mapping, flow, save, text). Phaser is never imported here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
});
