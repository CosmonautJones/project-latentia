import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the built game also runs from a sub-path (artifact or Pages host).
  base: './',
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; it ships as one vendor chunk on purpose.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
