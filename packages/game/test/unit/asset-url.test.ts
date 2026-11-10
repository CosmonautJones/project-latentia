import { describe, expect, it } from 'vitest';
import { assetUrl, inlineAssets } from '../../src/asset-url.js';
import { FABLE_SHEETS } from '../../src/battle/creature-art.js';

describe('assetUrl', () => {
  it('outside the single-file build (here, Vitest) nothing is inlined and the relative URL is kept', () => {
    expect(inlineAssets()).toBeNull();
    for (const s of Object.values(FABLE_SHEETS)) expect(assetUrl(s.file)).toBe(s.file);
  });

  it('in the single-file build a sheet resolves to its data: URI', () => {
    const inline = { 'assets/sagelet-idle.png': 'data:image/png;base64,AAAA' };
    expect(assetUrl('assets/sagelet-idle.png', inline)).toBe('data:image/png;base64,AAAA');
    expect(assetUrl('assets/other.png', inline)).toBe('assets/other.png');
  });
});
