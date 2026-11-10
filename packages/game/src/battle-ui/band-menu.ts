// The portrait battle menus, as DOM buttons in the bottom band's `#band-panel` (bible: the DS-style second screen
// holds the menus so touch targets stay large: every row is at least 44 CSS px). It renders the same menu state as
// the canvas, in the game font as SVG; a tap picks the item through the action stream, so keys, the D-pad and taps
// all drive one menu. The panel scrolls when a short phone cannot fit the whole list, keeps the hint header pinned,
// and scrolls the cursor row into view.

import type { Temperature } from '@latentia/engine';
import { armedHere, menuView, moveHint, TEMPERATURE_TIPS } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import type { App } from '../app.js';
import { textSvg } from '../text/glyph-svg.js';
import { wrapText } from '../text/wrap.js';
import { COLOR, css } from '../ui/palette.js';
import type { BoxModel } from './command-box.js';

const SCALE = 2;
const HEADER_CHARS = 28;
const LOG_CHARS = 28;

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
    const armed = armedHere(menu);
    const header = (text: string, color: number = COLOR.cloud) => {
      const h = doc.createElement('div');
      h.className = 'band-header';
      h.innerHTML = wrapText(text, HEADER_CHARS)
        .slice(0, 4)
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
      b.className = `band-btn${index === view.index ? ' cursor' : ''}${index === view.index && armed ? ' armed' : ''}${opts.warn ? ' warn' : ''}`;
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
        // The prompt is on the game screen above; the band holds only the commands.
        const grid = buttons('grid');
        view.items.forEach((item, i) => button(grid, i, i === 2 && model.whyFresh ? `${item}!` : item));
        break;
      }
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        header(`${m === undefined ? '' : moveHint(m)}${armed ? '  TAP AGAIN TO USE.' : ''}`, m?.affordable === false ? COLOR.amber : COLOR.cloud);
        const list = buttons('list');
        data.moves.forEach((opt, i) =>
          button(list, i, opt.name.toUpperCase(), {
            right: String(opt.cost),
            warn: !opt.affordable,
            tick: opt.type === 'system' ? COLOR.mist : (TYPE_COLORS[opt.type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist),
          }),
        );
        break;
      }
      case 'targets': {
        header(armed ? 'TAP AGAIN TO USE IT ON THIS ONE.' : 'PICK A TARGET.  B: BACK');
        const list = buttons('list');
        view.items.forEach((item, i) => button(list, i, item));
        break;
      }
      case 'temp': {
        header(`${TEMPERATURE_TIPS[menu.tempIndex as Temperature]}${armed ? '  TAP AGAIN TO SET.' : ''}`);
        const row = buttons('row');
        view.items.forEach((item, i) => button(row, i, item));
        break;
      }
      case 'log': {
        header('ROUND LOG.  B: BACK');
        const log = doc.createElement('div');
        log.className = 'band-log';
        view.items.forEach((line, i) => {
          const row = doc.createElement('div');
          row.className = `band-log-line${i === view.index ? ' cursor' : ''}`;
          row.innerHTML = wrapText(line, LOG_CHARS)
            .map((l) => textSvg(l, SCALE, css(i === view.index ? COLOR.white : COLOR.mist)))
            .join('<br>');
          log.append(row);
        });
        this.root.append(log);
        break;
      }
    }
    this.root.querySelector('.cursor')?.scrollIntoView({ block: 'nearest' });
  }
}
