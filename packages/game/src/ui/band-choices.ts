// A ChoicePanel's rows mirrored as DOM buttons in the portrait band's `#band-panel` (bible: the DS-style second screen
// holds the menus so touch targets stay at least 44 CSS px). Labels are drawn in the game font as SVG; a tap picks the
// row through the action stream, the same as a tap on the canvas row. Hidden with the band in landscape.

import type { App } from '../app.js';
import { textSvg } from '../text/glyph-svg.js';
import { wrapText } from '../text/wrap.js';
import { COLOR, css } from './palette.js';

const SCALE = 2;
const CHARS = 28;

export class BandChoices {
  private readonly root: HTMLElement;

  constructor(
    panel: HTMLElement,
    private readonly app: App,
    private readonly id: string,
    private readonly labels: readonly string[],
  ) {
    this.root = panel.ownerDocument.createElement('div');
    this.root.className = 'band-menu band-choices';
    panel.append(this.root);
  }

  render(cursor: number): void {
    const doc = this.root.ownerDocument;
    const list = doc.createElement('div');
    list.className = 'band-buttons list';
    this.labels.forEach((label, i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = `band-btn${i === cursor ? ' cursor' : ''}`;
      b.dataset['menu'] = this.id;
      b.dataset['index'] = String(i);
      const lines = wrapText(label, CHARS).map((l) => textSvg(l, SCALE, css(i === cursor ? COLOR.white : COLOR.mist)));
      b.innerHTML = `<span class="label">${lines.join('<br>')}</span>`;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.app.input.pick(this.id, i);
      });
      list.append(b);
    });
    this.root.replaceChildren(list);
    this.root.querySelector('.cursor')?.scrollIntoView({ block: 'nearest' });
  }

  destroy(): void {
    this.root.remove();
  }
}
