import { describe, expect, it } from 'vitest';
import { assetUrl, inlineAssets } from '../../src/asset-url.js';
import { ART, artFile } from '../../src/art/sheets.js';

describe('assetUrl', () => {
  it('outside the single-file build (here, Vitest) nothing is inlined and the relative URL is kept', () => {
    expect(inlineAssets()).toBeNull();
    for (const s of Object.values(ART.sheets)) expect(assetUrl(artFile(s.file))).toBe(artFile(s.file));
  });

  it('in the single-file build a sheet resolves to its data: URI, folders included', () => {
    const inline = { 'assets/art/battle/sagelet.png': 'data:image/png;base64,AAAA' };
    expect(assetUrl('assets/art/battle/sagelet.png', inline)).toBe('data:image/png;base64,AAAA');
    expect(assetUrl('assets/art/other.png', inline)).toBe('assets/art/other.png');
  });
});
