// A small one-off notice over the page's top edge, in the game font (DOM, so it sits outside the 320x180 screen and
// never covers a menu for long). Used once: "saves unavailable" when localStorage can't be used.

import { textSvg } from '../text/glyph-svg.js';
import { COLOR, css } from './palette.js';

const SHOW_MS = 6000;

export function showNotice(doc: Document, text: string): void {
  const el = doc.createElement('div');
  el.id = 'notice';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', text);
  el.innerHTML = textSvg(text, 2, css(COLOR.amber));
  doc.body.append(el);
  setTimeout(() => el.classList.add('gone'), SHOW_MS);
}
