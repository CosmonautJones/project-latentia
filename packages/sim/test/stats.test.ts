import { describe, expect, it } from 'vitest';
import { addScores, median, pointVerdict, rate, verdict, wilson95, winRate } from '../src/stats.js';

describe('wilson95', () => {
  it('500 of 1000 is about [0.4691, 0.5309]', () => {
    const [lo, hi] = wilson95(500, 1000);
    expect(lo).toBeCloseTo(0.4691, 3);
    expect(hi).toBeCloseTo(0.5309, 3);
  });
  it('stays inside [0, 1] at the extremes and for n = 0', () => {
    const [lo, hi] = wilson95(0, 50);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0);
    expect(wilson95(50, 50)[1]).toBeCloseTo(1, 12);
    expect(wilson95(0, 0)).toEqual([0, 1]);
  });
});

describe('winRate', () => {
  it('counts a draw as half a win', () => {
    expect(winRate({ winsA: 2, winsB: 1, draws: 2, rounds: [], capHits: 0 })).toBeCloseTo(0.6, 12);
    expect(winRate({ winsA: 0, winsB: 0, draws: 0, rounds: [], capHits: 0 })).toBe(0);
  });
});

describe('verdict', () => {
  const band: [number, number] = [0.45, 0.55];
  it('passes when the point and the whole interval are inside the band', () => {
    expect(verdict(0.5, [0.47, 0.53], band)).toBe('pass');
  });
  it('is inconclusive when the point is inside but the interval crosses an edge', () => {
    expect(verdict(0.5, [0.44, 0.56], band)).toBe('inconclusive');
    expect(verdict(0.46, [0.43, 0.5], band)).toBe('inconclusive');
  });
  it('fails when the point is outside, whatever the interval', () => {
    expect(verdict(0.6, [0.5, 0.7], band)).toBe('fail');
    expect(verdict(0.4, [0.36, 0.44], band)).toBe('fail');
  });
  it('treats the band edges as inside', () => {
    expect(verdict(0.45, [0.45, 0.5], band)).toBe('pass');
    expect(verdict(0.5, [0.5, 0.55], band)).toBe('pass');
    expect(pointVerdict(0.45, band)).toBe('pass');
    expect(pointVerdict(0.55, band)).toBe('pass');
    expect(pointVerdict(0.5501, band)).toBe('fail');
  });
});

describe('Score helpers', () => {
  it('rate is points per battle (0 with none) and addScores sums points and battles', () => {
    expect(rate({ points: 7.5, n: 10 })).toBe(0.75);
    expect(rate({ points: 0, n: 0 })).toBe(0);
    expect(addScores({ points: 1.5, n: 2 }, { points: 3, n: 4 })).toEqual({ points: 4.5, n: 6 });
    expect(addScores()).toEqual({ points: 0, n: 0 });
  });
  it('median takes the middle value, or the mean of the two middle values, without sorting its input', () => {
    const xs = [9, 1, 5];
    expect(median(xs)).toBe(5);
    expect(xs).toEqual([9, 1, 5]);
    expect(median([4, 1, 10, 6])).toBe(5);
    expect(median([])).toBeNaN();
  });
});
