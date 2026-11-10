// The portrait battle menus, as DOM buttons in the bottom band's `#band-panel` (bible: the DS-style second screen
// holds the menus so touch targets stay large). It renders the same menu state as the canvas, in the game font as
// SVG; a tap picks the item through the action stream, so keys, the D-pad and taps all drive one menu.

import type { Temperature } from '@latentia/engine';
import { menuView, moveHint, TEMPERATURE_TIPS } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import type { App } from '../app.js';
import { textSvg } from '../text/glyph-svg.js';
import { wrapText } from '../text/wrap.js';
import { COLOR, css } from '../ui/palette.js';
import type { BoxModel } from './command-box.js';

const SCALE = 2;
const HEADER_CHARS = 28;

export class BandMenu {
  private readonly root: HTMLElement;

  constructor(
    panel: HTMLElement,
    private readonly app: App,
  ) {
    this.root = panel.ownerDocument.createElement('div');
    this.root.className = 'band-menu';
    panel.replaceChildren(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  render(model: BoxModel): void {
    const doc = this.root.ownerDocument;
    this.root.replaceChildren();
    if (model.kind === 'message') return;
    const { menu, data } = model;
    const view = menuView(menu, data);
    const header = (text: string, color: number = COLOR.cloud) => {
      const h = doc.createElement('div');
      h.className = 'band-header';
      h.innerHTML = wrapText(text, HEADER_CHARS)
        .slice(0, 3)
        .map((l) => textSvg(l, SCALE, css(color)))
        .join('<br>');
      this.root.append(h);
    };
    const buttons = (cls: string) => {
      const box = doc.createElement('div');
      box.className = `band-buttons ${cls}`;
      this.root.append(box);
      return box;
    };
    const button = (parent: HTMLElement, index: number, label: string, opts: { right?: string; warn?: boolean; tick?: number } = {}) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = `band-btn${index === view.index ? ' cursor' : ''}${opts.warn ? ' warn' : ''}`;
      b.dataset['menu'] = view.id;
      b.dataset['index'] = String(index);
      const tick = opts.tick === undefined ? '' : `<span class="tick" style="background:${css(opts.tick)}"></span>`;
      const right = opts.right === undefined ? '' : `<span class="right">${textSvg(opts.right, SCALE, css(opts.warn ? COLOR.red : COLOR.cyan))}</span>`;
      b.innerHTML = `${tick}<span class="label">${textSvg(label, SCALE, css(opts.warn ? COLOR.steel : COLOR.white))}</span>${right}`;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.app.input.pick(view.id, index);
      });
      parent.append(b);
    };

    switch (menu.screen) {
      case 'root': {
        header(model.prompt, COLOR.white);
        const grid = buttons('grid');
        view.items.forEach((item, i) => button(grid, i, i === 2 && model.whyFresh ? `${item}!` : item));
        return;
      }
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        header(m === undefined ? '' : moveHint(m), m?.affordable === false ? COLOR.amber : COLOR.cloud);
        const list = buttons('list');
        data.moves.forEach((opt, i) =>
          button(list, i, opt.name.toUpperCase(), {
            right: String(opt.cost),
            warn: !opt.affordable,
            tick: opt.type === 'system' ? COLOR.mist : (TYPE_COLORS[opt.type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist),
          }),
        );
        return;
      }
      case 'targets': {
        header('Pick a target.  B: back');
        const list = buttons('list');
        view.items.forEach((item, i) => button(list, i, item));
        return;
      }
      case 'temp': {
        header(TEMPERATURE_TIPS[menu.tempIndex as Temperature]);
        const row = buttons('row');
        view.items.forEach((item, i) => button(row, i, item));
        return;
      }
    }
  }
}
