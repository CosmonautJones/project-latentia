// Latentia art pass 2: a tiny palette-index drawing kit.
//
// Pass 1 authored every part as a hand-typed text grid and slid the parts
// around; the notes called the result stiff. Pass 2 keeps text grids for the
// parts that need a hand (faces, glyphs, small props: see `stamp`) and draws
// the big forms as shapes, so every animation frame is re-rasterised from its
// pose instead of translated. Everything still lands on Endesga 32 indices.
//
// Colours are the same single characters as the text grids (base 32 index):
//   0 rust   1 ember  2 cream  3 tan    4 wood   5 bark   6 plum   7 red
//   8 scarlet 9 orange a amber b lemon  c leaf   d green  e pine   f deep
//   g blue   h sky    i cyan   j white  k cloud  l mist   m steel  n slate
//   o night  p ink    q hot    r violet s magenta t pink  u skin   v skin shade

export const PALETTE = [
  'be4a2f', 'd77643', 'ead4aa', 'e4a672', 'b86f50', '733e39', '3e2731', 'a22633',
  'e43b44', 'f77622', 'feae34', 'fee761', '63c74d', '3e8948', '265c42', '193c3e',
  '124e89', '0099db', '2ce8f5', 'ffffff', 'c0cbdc', '8b9bb4', '5a6988', '3a4466',
  '262b44', '181425', 'ff0044', '68386c', 'b55088', 'f6757a', 'e8b796', 'c28569',
];
export const CHARS = '0123456789abcdefghijklmnopqrstuv';
export const RGB = PALETTE.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
export const T = -1;
const ci = (ch) => {
  if (typeof ch === 'number') return ch;
  const i = CHARS.indexOf(ch);
  if (i < 0) throw new Error(`'${ch}' is not a palette index`);
  return i;
};

/** A stable hash in [0,1) for speckle, so builds are reproducible. */
export function noise(x, y, seed = 0) {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const LIGHT = (() => {
  const v = [-0.5, -0.62, 0.6];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

export class Cv {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Int8Array(w * h).fill(T);
  }

  clone() {
    const c = new Cv(this.w, this.h);
    c.px.set(this.px);
    return c;
  }

  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? T : this.px[y * this.w + x];
  }

  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c === null ? T : ci(c);
    return this;
  }

  /** Several pixels at once: dots('p', [x,y], [x,y], ...). */
  dots(c, ...pts) {
    for (const [x, y] of pts) this.set(x, y, c);
    return this;
  }

  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    return this;
  }

  // ------------------------------------------------------------ masks

  mask(fn) {
    const m = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (fn(x + 0.5, y + 0.5)) m[y * this.w + x] = 1;
    return m;
  }

  ell(cx, cy, rx, ry, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return this.mask((x, y) => {
      const dx = x - cx, dy = y - cy;
      const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
      return u * u + v * v <= 1;
    });
  }

  /** Superellipse: n = 2 is an ellipse, larger n is boxier. */
  sup(cx, cy, rx, ry, n = 4) {
    return this.mask((x, y) => Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1);
  }

  poly(pts) {
    return this.mask((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  /** A thick line from a to b whose radius tapers from r0 to r1. */
  cap(x0, y0, x1, y1, r0, r1 = r0) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
    return this.mask((x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      return Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) <= r0 + (r1 - r0) * t;
    });
  }

  /** A chain of tapered segments: pts = [[x, y, r], ...]. */
  tube(pts) {
    let m = new Uint8Array(this.w * this.h);
    for (let i = 0; i + 1 < pts.length; i++) m = or(m, this.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2]));
    return m;
  }

  box(x, y, w, h) {
    return this.mask((px, py) => px >= x && px < x + w && py >= y && py < y + h);
  }

  /** The canvas's own opaque pixels. */
  opaque() {
    const m = new Uint8Array(this.w * this.h);
    for (let i = 0; i < m.length; i++) m[i] = this.px[i] === T ? 0 : 1;
    return m;
  }

  // ------------------------------------------------------------ paint

  paint(m, c) {
    const k = ci(c);
    for (let i = 0; i < m.length; i++) if (m[i]) this.px[i] = k;
    return this;
  }

  erase(m) {
    for (let i = 0; i < m.length; i++) if (m[i]) this.px[i] = T;
    return this;
  }

  /** Recolour inside a mask: map = { from: to } in palette characters. Used for cast shadows. */
  remap(m, map) {
    const t = new Map(Object.entries(map).map(([a, b]) => [ci(a), ci(b)]));
    for (let i = 0; i < m.length; i++) if (m[i] && t.has(this.px[i])) this.px[i] = t.get(this.px[i]);
    return this;
  }

  /** Paint a mask through a ramp (light to dark) by a per-pixel brightness; th are descending thresholds. */
  bands(m, ramp, th, lam, smooth = 1) {
    const idx = new Int8Array(m.length).fill(-1);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (!m[i]) continue;
        const l = lam(x, y);
        let b = th.findIndex((t) => l > t);
        if (b < 0) b = th.length;
        idx[i] = Math.min(b, ramp.length - 1);
      }
    }
    // A 3x3 mode filter clears single-pixel islands, the main source of orphans and banding noise.
    for (let pass = 0; pass < smooth; pass++) {
      const src = idx.slice();
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const i = y * this.w + x;
          if (src[i] < 0) continue;
          const count = new Array(ramp.length).fill(0);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
              const v = src[yy * this.w + xx];
              if (v >= 0) count[v] += dx === 0 && dy === 0 ? 1.5 : 1;
            }
          }
          let best = src[i];
          for (let b = 0; b < count.length; b++) if (count[b] > count[best]) best = b;
          idx[i] = best;
        }
      }
    }
    for (let i = 0; i < m.length; i++) if (idx[i] >= 0) this.px[i] = ci(ramp[idx[i]]);
    return this;
  }

  /** Shade a mask as one ellipsoid lit from the top-left. */
  ball(m, cx, cy, rx, ry, ramp, th = [0.9, 0.42, 0.08]) {
    return this.bands(m, ramp, th, (x, y) => {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      return dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2];
    });
  }

  /**
   * Shade any mask as a soft relief: the surface rises over R pixels from the edge, then is flat.
   * Thin shapes come out as lit-above, dark-below cylinders; wide ones get a rim and a flat middle.
   */
  relief(m, ramp, { R = 5, th = [0.86, 0.4, 0.05], smooth = 1 } = {}) {
    const d = edgeDistance(m, this.w, this.h, R + 1);
    const hgt = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !m[y * this.w + x]) return 0;
      const u = Math.min(d[y * this.w + x] / R, 1);
      return R * Math.sqrt(1 - (1 - u) * (1 - u));
    };
    return this.bands(m, ramp, th, (x, y) => {
      const gx = (hgt(x + 1, y) - hgt(x - 1, y)) / 2, gy = (hgt(x, y + 1) - hgt(x, y - 1)) / 2;
      const n = Math.hypot(gx, gy, 1);
      return (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) / n;
    }, smooth);
  }

  /** A 1 px line around a mask, outside it. `lit` colours the top and left edges (selective outlining). */
  inline(m, c, lit = c) {
    return this.outline(m, c, lit, true);
  }

  outline(m, c, lit = c, inside = false) {
    const dark = ci(c), light = ci(lit);
    const at = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && m[y * this.w + x];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        const below = at(x, y + 1), right = at(x + 1, y), above = at(x, y - 1), left = at(x - 1, y);
        if (!(below || right || above || left)) continue;
        if (inside && this.px[y * this.w + x] === T) continue; // an inner line never grows the silhouette
        this.px[y * this.w + x] = (below || right) && !above && !left ? light : dark;
      }
    }
    return this;
  }

  /** Paint a mask flat or shaded and outline it in one go. */
  part(m, fill, line, lit) {
    if (line) this.outline(m, line, lit ?? line);
    if (typeof fill === 'function') fill(m);
    else this.paint(m, fill);
    return this;
  }

  /**
   * Final pass. Every opaque pixel on the outer silhouette becomes `dark`, except on the lit
   * (top-left) edges where the part's own coloured line is kept if `keepLit`.
   */
  silhouette(dark = 'p', keepLit = false) {
    const k = ci(dark);
    const src = this.px.slice();
    const clear = (x, y) => x < 0 || y < 0 || x >= this.w || y >= this.h || src[y * this.w + x] === T;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] === T) continue;
        const up = clear(x, y - 1), lf = clear(x - 1, y), dn = clear(x, y + 1), rt = clear(x + 1, y);
        if (!(up || lf || dn || rt)) continue;
        if (keepLit && (up || lf) && !dn && !rt) continue;
        this.px[y * this.w + x] = k;
      }
    }
    return this;
  }

  /** Draw a hand-authored text grid ('.' is transparent). */
  stamp(text, x, y, { flip = false, map = null } = {}) {
    const rows = grid(text);
    rows.forEach((row, dy) => {
      const n = row.length;
      [...row].forEach((ch, dx) => {
        if (ch === '.') return;
        const c = map && ch in map ? map[ch] : ch;
        if (c === '.') return;
        this.set(x + (flip ? n - 1 - dx : dx), y + dy, c);
      });
    });
    return this;
  }

  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x];
        if (c !== T) this.set(x + ox, y + oy, c);
      }
    }
    return this;
  }

  mirrored() {
    const c = new Cv(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.px[y * this.w + x] = this.px[y * this.w + (this.w - 1 - x)];
    return c;
  }

  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.px[y * this.w + x] === T) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** Opaque pixels with no 8-neighbour of their own colour. Some are deliberate (glints). */
  orphans() {
    let n = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (c === T) continue;
        let friend = false;
        for (let dy = -1; dy <= 1 && !friend; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.get(x + dx, y + dy) === c) { friend = true; break; }
        if (!friend) n++;
      }
    }
    return n;
  }
}

export const grid = (text) => text.split('\n').map((l) => l.trim()).filter((l) => l !== '');

export const or = (...ms) => ms.reduce((a, b) => a.map((v, i) => v | b[i]));
export const and = (a, b) => a.map((v, i) => v & b[i]);
export const sub = (a, b) => a.map((v, i) => (b[i] ? 0 : v));
/** Shift a mask by whole pixels (for cast shadows and inner lines). */
export function shift(m, w, dx, dy) {
  const h = m.length / w;
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - dx, sy = y - dy;
      if (sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx]) out[y * w + x] = 1;
    }
  }
  return out;
}

/** Distance from each mask pixel to the nearest pixel outside the mask, capped at `max`. */
function edgeDistance(m, w, h, max) {
  const d = new Float32Array(m.length);
  const r = Math.ceil(max) + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      let best = max;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          const out = xx < 0 || yy < 0 || xx >= w || yy >= h || !m[yy * w + xx];
          if (!out) continue;
          const dist = Math.hypot(dx, dy) - 0.5;
          if (dist < best) best = dist;
        }
      }
      d[y * w + x] = best;
    }
  }
  return d;
}

/** Smooth 0..1..0 loop helpers for six-frame idles: phase p in [0,1). */
export const wave = (p, lag = 0) => Math.sin((p - lag) * Math.PI * 2);
