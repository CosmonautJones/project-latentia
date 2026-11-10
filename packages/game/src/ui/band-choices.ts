// A ChoicePanel's rows as DOM buttons in the band's `#band-panel` (bible: the DS-style second screen holds the menus
// so touch targets stay at least 44 CSS px). Each button has its label and, smaller and dimmer under it, the row's
// one-line detail; the canvas panel then shows only the title and body, so nothing is shown twice. Text is drawn in
// the game font as SVG, sized for the band (ui/band-sizing.ts); a tap picks the row through the action stream, the
// same as a key or a tap on a canvas row. Used whenever the layout puts menus in the band (portrait, touch landscape).

import type { App } from '../app.js';
import { textSvg } from '../text/glyph-svg.js';
import { wrapText } from '../text/wrap.js';
import { bandText } from './band-sizing.js';
import type { ChoiceItem } from './choice-panel.js';
import { COLOR, css } from './palette.js';

export class BandChoices {
  private readonly root: HTMLElement;

  constructor(
    panel: HTMLElement,
    private readonly app: App,
    private readonly id: string,
    private readonly items: readonly ChoiceItem[],
  ) {
    this.root = panel.ownerDocument.createElement('div');
    this.root.className = 'band-menu band-choices';
    panel.append(this.root);
  }

  render(cursor: number): void {
    const doc = this.root.ownerDocument;
    // A wide band shows up to three choices side by side, so the starter pick and the debrief never scroll.
    const size = bandText(this.app.screen.layout(), { columns: Math.min(3, this.items.length) });
    const list = doc.createElement('div');
    list.className = `band-buttons list cols-${size.columns}`;
    this.items.forEach((item, i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = `band-btn${i === cursor ? ' cursor' : ''}`;
      b.dataset['menu'] = this.id;
      b.dataset['index'] = String(i);
      const label = wrapText(item.label, size.label.chars).map((l) => textSvg(l, size.label.scale, css(i === cursor ? COLOR.white : COLOR.mist)));
      const detail = item.detail ? wrapText(item.detail, size.detail.chars).map((l) => textSvg(l, size.detail.scale, css(COLOR.steel))) : [];
      b.innerHTML = `<span class="label">${label.join('<br>')}</span>${detail.length > 0 ? `<span class="detail">${detail.join('<br>')}</span>` : ''}`;
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
