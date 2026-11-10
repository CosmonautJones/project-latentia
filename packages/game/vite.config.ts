import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const PUBLIC = join(import.meta.dirname, 'public');
const MIME: Readonly<Record<string, string>> = { '.png': 'image/png', '.svg': 'image/svg+xml' };
const dataUri = (file: string) => `data:${MIME[extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

/** Every file under public/assets/ as `assets/<name>` → a data: URI, for the single-file build. */
function inlineAssets(): Record<string, string> {
  const dir = join(PUBLIC, 'assets');
  return Object.fromEntries(readdirSync(dir).map((f) => [`assets/${f}`, dataUri(join(dir, f))]));
}

/** The single-file build's page: the favicon (a public file the page links) becomes a data: URI too. */
function inlineFavicon(): Plugin {
  return {
    name: 'latentia-inline-favicon',
    transformIndexHtml: (html) => html.replace('href="./favicon.svg"', () => `href="${dataUri(join(PUBLIC, 'favicon.svg'))}"`),
  };
}

export default defineConfig(({ mode }) => {
  // `vite build --mode single`: one self-contained dist-single/index.html (JS and CSS inlined, every image a data:
  // URI), so it runs in a sandboxed iframe with an opaque origin, where module scripts and Phaser's XHR image loads
  // from relative URLs would need CORS. See README "Publishing".
  const single = mode === 'single';
  return {
    // Relative asset URLs so the built game also runs from a sub-path (artifact or Pages host).
    base: './',
    // src/asset-url.ts reads this: the data: URIs in the single-file build, null everywhere else.
    define: { __LATENTIA_INLINE_ASSETS__: single ? JSON.stringify(inlineAssets()) : 'null' },
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true }), inlineFavicon()] : [],
    build: single
      ? {
          target: 'es2022',
          outDir: 'dist-single',
          // Nothing from public/ is copied: what the page needs is inlined above.
          copyPublicDir: false,
          chunkSizeWarningLimit: 4000,
        }
      : {
          target: 'es2022',
          // Phaser alone is ~1.2 MB minified; it ships as one vendor chunk on purpose.
          chunkSizeWarningLimit: 1600,
          rollupOptions: {
            output: {
              manualChunks: { phaser: ['phaser'] },
            },
          },
        },
  };
});
