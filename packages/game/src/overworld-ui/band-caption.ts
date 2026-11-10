// The portrait band under the overworld: where you are and what the buttons do, in the game font, so the second
// screen isn't blank while walking (the battle puts its menus here instead).

import { textSvg } from '../text/glyph-svg.js';
import { COLOR, css } from '../ui/palette.js';

const SCALE = 2;

export class BandCaption {
  private readonly root: HTMLElement;
  private shown: string | null = null;

  constructor(panel: HTMLElement) {
    this.root = panel.ownerDocument.createElement('div');
    this.root.className = 'band-menu band-caption';
    panel.replaceChildren(this.root);
  }

  /** Show `place` (cheap to call every frame: it redraws only when the place changes). */
  show(place: string): void {
    if (place === this.shown) return;
    this.shown = place;
    const line = (text: string, color: number) => {
      const el = this.root.ownerDocument.createElement('div');
      el.innerHTML = textSvg(text, SCALE, css(color));
      return el;
    };
    this.root.replaceChildren(line(place.toUpperCase(), COLOR.amber), line('D-PAD: WALK   A: TALK / READ', COLOR.mist));
  }

  destroy(): void {
    this.root.remove();
  }
}
