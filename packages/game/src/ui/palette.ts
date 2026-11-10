// Endesga 32, the locked palette (design bible "palette, shape language and spec sheet"), as 0xRRGGBB numbers.
// Named by role where the UI uses them; the full list stays available for generated placeholders.

export const ENDESGA_32 = [
  0xbe4a2f, 0xd77643, 0xead4aa, 0xe4a672, 0xb86f50, 0x733e39, 0x3e2731, 0xa22633,
  0xe43b44, 0xf77622, 0xfeae34, 0xfee761, 0x63c74d, 0x3e8948, 0x265c42, 0x193c3e,
  0x124e89, 0x0099db, 0x2ce8f5, 0xffffff, 0xc0cbdc, 0x8b9bb4, 0x5a6988, 0x3a4466,
  0x262b44, 0x181425, 0xff0044, 0x68386c, 0xb55088, 0xf6757a, 0xe8b796, 0xc28569,
] as const;

export const COLOR = {
  ink: 0x181425,
  night: 0x262b44,
  slate: 0x3a4466,
  steel: 0x5a6988,
  mist: 0x8b9bb4,
  cloud: 0xc0cbdc,
  white: 0xffffff,
  navy: 0x124e89,
  blue: 0x0099db,
  cyan: 0x2ce8f5,
  amber: 0xfeae34,
  lemon: 0xfee761,
  red: 0xe43b44,
  green: 0x63c74d,
  magenta: 0xb55088,
  cream: 0xead4aa,
} as const;

export const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
