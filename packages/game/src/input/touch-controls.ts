// The touch D-pad and A/B buttons (DOM, so the hit areas stay large and exact at any game scale). They sit in
// the portrait band, or overlay a touch landscape screen; labels are drawn from the game font as SVG.

import { glyphSvg } from '../text/glyph-svg.js';
import { css, COLOR } from '../ui/palette.js';
import { touchControlButton, type TouchControlId } from './actions.js';
import type { InputHub } from './hub.js';

const LABELS: Readonly<Record<TouchControlId, string>> = {
  'dpad-up': '↑',
  'dpad-down': '↓',
  'dpad-left': '←',
  'dpad-right': '→',
  'btn-a': 'A',
  'btn-b': 'B',
};

function button(doc: Document, id: TouchControlId, hub: InputHub): HTMLButtonElement {
  const el = doc.createElement('button');
  el.type = 'button';
  el.className = `touch-btn ${id}`;
  el.dataset['control'] = id;
  el.setAttribute('aria-label', id.replace('dpad-', '').replace('btn-', '').toUpperCase());
  el.innerHTML = glyphSvg(LABELS[id], 4, css(COLOR.cloud));
  const mapped = touchControlButton(id);
  if (!mapped) throw new Error(`unmapped touch control ${id}`);
  const press = (e: PointerEvent) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('held');
    hub.press(mapped, 'touch');
  };
  const release = () => {
    if (!el.classList.contains('held')) return;
    el.classList.remove('held');
    hub.release(mapped, 'touch');
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}

/** Build the controls into `root` (cleared first). */
export function mountTouchControls(root: HTMLElement, hub: InputHub): void {
  const doc = root.ownerDocument;
  root.replaceChildren();
  const dpad = doc.createElement('div');
  dpad.className = 'dpad';
  for (const id of ['dpad-up', 'dpad-left', 'dpad-right', 'dpad-down'] as const) dpad.append(button(doc, id, hub));
  const ab = doc.createElement('div');
  ab.className = 'ab';
  for (const id of ['btn-b', 'btn-a'] as const) ab.append(button(doc, id, hub));
  root.append(dpad, ab);
}
