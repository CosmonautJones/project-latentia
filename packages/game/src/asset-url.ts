// Where the game loads a public asset from. In the single-file build (`vite build --mode single`) vite.config.ts
// defines __LATENTIA_INLINE_ASSETS__ as `assets/<name>` → data: URI, so Phaser's loader decodes the image from
// memory and never fetches; in every other build it is null and the relative URL is used as is.

declare const __LATENTIA_INLINE_ASSETS__: Readonly<Record<string, string>> | null | undefined;

/** The inlined assets, or null (also under Vitest, which does not define the constant). */
export function inlineAssets(): Readonly<Record<string, string>> | null {
  return typeof __LATENTIA_INLINE_ASSETS__ === 'undefined' ? null : __LATENTIA_INLINE_ASSETS__;
}

/** The URL to load `file` (relative to the page, e.g. `assets/sagelet-idle.png`) from. */
export function assetUrl(file: string, inline = inlineAssets()): string {
  return inline?.[file] ?? file;
}
