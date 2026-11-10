import { describe, expect, it } from 'vitest';
import { textSvg } from '../../src/text/glyph-svg.js';
import { paginate, sanitize, wrapText } from '../../src/text/wrap.js';
import {
  advance,
  createTypewriter,
  FAST_MULTIPLIER,
  isPageComplete,
  tick,
  visibleText,
  type TypewriterState,
} from '../../src/ui/typewriter.js';

describe('sanitize', () => {
  it('keeps font characters and replaces anything else with ?', () => {
    expect(sanitize('Hi… → ✓ ×')).toBe('Hi… → ✓ ×');
    expect(sanitize('café €5')).toBe('caf? ?5');
  });

  it('normalises curly quotes and dashes to ASCII the font has', () => {
    expect(sanitize('“It’s” — fine – ok')).toBe('"It\'s" - fine - ok');
  });
});

describe('wrapText', () => {
  it('wraps on word boundaries at maxChars', () => {
    expect(wrapText('the quick brown fox jumps over', 10)).toEqual(['the quick', 'brown fox', 'jumps over']);
  });

  it('keeps explicit newlines and collapses runs of spaces', () => {
    expect(wrapText('one\ntwo   three', 20)).toEqual(['one', 'two three']);
  });

  it('hard-breaks a word longer than the line', () => {
    expect(wrapText('supercalifragilistic', 8)).toEqual(['supercal', 'ifragili', 'stic']);
  });

  it('never returns a line longer than maxChars', () => {
    const lines = wrapText('Welcome to the lab. Every model here is state of the art, for about six weeks.', 36);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(36);
  });
});

describe('paginate', () => {
  it('chunks lines into pages of maxLines', () => {
    expect(paginate(['a', 'b', 'c', 'd'], 3)).toEqual([['a', 'b', 'c'], ['d']]);
    expect(paginate([], 3)).toEqual([[]]);
  });
});

describe('typewriter', () => {
  const make = (text: string): TypewriterState => createTypewriter(text, { maxChars: 10, maxLines: 2, charsPerSecond: 10 });

  it('starts with nothing visible and reveals at charsPerSecond', () => {
    let s = make('hello world again');
    expect(visibleText(s)).toBe('');
    s = tick(s, 300, false);
    expect(visibleText(s)).toBe('hel');
    s = tick(s, 250, false); // carry: 550 ms total
    expect(visibleText(s)).toBe('hello');
  });

  it('reveals across lines, joined by newlines', () => {
    let s = make('hello world again');
    s = tick(s, 1000, false);
    expect(visibleText(s)).toBe('hello\nworld');
    expect(isPageComplete(s)).toBe(true);
  });

  it('holding A or B speeds it up by FAST_MULTIPLIER', () => {
    expect(FAST_MULTIPLIER).toBeGreaterThan(1);
    const slow = tick(make('hello world again'), 100, false);
    const fast = tick(make('hello world again'), 100, true);
    expect(visibleText(slow)).toBe('h');
    expect(visibleText(fast).replace('\n', '').length).toBe(Math.min(10, FAST_MULTIPLIER));
  });

  it('A while the page is still typing finishes the page at once (tap-to-finish), without turning it', () => {
    const s = tick(make('hello world again'), 50, false);
    expect(isPageComplete(s)).toBe(false);
    const done = advance(s);
    expect(isPageComplete(done)).toBe(true);
    expect(done.page).toBe(0);
    expect(done.closed).toBe(false);
    expect(visibleText(done)).toBe(visibleText(tick(s, 5000, false)));
    // The next A turns the finished page as usual.
    expect(advance(done).page).toBe(1);
  });

  it('A on a complete page goes to the next page; A on the last complete page closes', () => {
    let s = tick(make('hello world again'), 5000, false);
    expect(s.page).toBe(0);
    s = advance(s);
    expect(s.page).toBe(1);
    expect(visibleText(s)).toBe('');
    s = tick(s, 5000, false);
    expect(visibleText(s)).toBe('again');
    expect(s.closed).toBe(false);
    s = advance(s);
    expect(s.closed).toBe(true);
  });

  it('ticking a closed or complete box is a no-op', () => {
    const done = tick(make('hi'), 5000, false);
    expect(tick(done, 1000, true)).toBe(done);
  });
});

describe('textSvg', () => {
  it('draws a line of the pixel font at an integer scale, descenders included', () => {
    const svg = textSvg('Ag', 2, '#ffffff');
    expect(svg).toContain('width="22" height="16"');
    expect(svg).toContain('fill="#ffffff"');
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThan(10);
    // Characters the font lacks become ?.
    expect(textSvg('€', 1, '#000')).toBe(textSvg('?', 1, '#000'));
  });
});
