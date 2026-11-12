// Copies the art package's built sheets into the game (plan v0.1 Q4 step 1): every sheet the manifest lists to
// public/assets/art/<file> (loaded at run time through src/asset-url.ts, so build:single inlines them), and the
// manifest itself to src/art/manifest.json (imported by src/art/sheets.ts). The contact sheets are left behind.
// Run: pnpm --filter @latentia/game sync-art   (after `pnpm --filter @latentia/art build:pass2`).

import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const GAME = join(import.meta.dirname, '..');
const OUT = join(GAME, '../art/out');
const DEST = join(GAME, 'public/assets/art');

const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) as { sheets: Record<string, { file: string }> };
rmSync(DEST, { recursive: true, force: true });
for (const { file } of Object.values(manifest.sheets)) {
  mkdirSync(dirname(join(DEST, file)), { recursive: true });
  copyFileSync(join(OUT, file), join(DEST, file));
}
copyFileSync(join(OUT, 'manifest.json'), join(GAME, 'src/art/manifest.json'));
console.log(`sync-art: ${Object.keys(manifest.sheets).length} sheets and the manifest copied from packages/art/out`);
