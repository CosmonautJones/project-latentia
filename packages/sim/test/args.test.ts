import { describe, expect, it } from 'vitest';
import { num, parseArgs, tag, usageLine, UsageError, type CommandSpec } from '../src/args.js';

const SPEC: CommandSpec = { name: 'demo', positionals: ['a', 'b'], flags: { seeds: 'int', 'seeds-scale': 'num', tag: 'tag' } };
const bad = (args: string[]) => () => parseArgs(args, SPEC);

describe('parseArgs (Ruling 137)', () => {
  it('reads declared flags in both spellings and the positionals', () => {
    const p = parseArgs(['x', '--seeds', '10', 'y', '--seeds-scale=0.5', '--tag', 'scratch'], SPEC);
    expect(p.positionals).toEqual(['x', 'y']);
    expect(num(p, 'seeds', 1)).toBe(10);
    expect(num(p, 'seeds-scale', 1)).toBe(0.5);
    expect(tag(p, 'tag')).toBe('scratch');
    expect(num(parseArgs(['x', 'y'], SPEC), 'seeds', 7)).toBe(7);
    expect(tag(parseArgs(['x', 'y'], SPEC), 'tag')).toBeUndefined();
  });
  it('rejects an unknown or misspelt flag, naming it and the usage', () => {
    expect(bad(['x', 'y', '--seed', '10'])).toThrow(UsageError);
    expect(bad(['x', 'y', '--seed', '10'])).toThrow(/unknown flag --seed\nusage: demo <a> <b> \[--seeds N\]/);
    expect(bad(['x', 'y', '--toString', '1'])).toThrow(/unknown flag --toString/);
    expect(bad(['x', 'y', '-s', '1'])).toThrow(/unexpected argument -s/);
  });
  it('rejects extra and missing positionals', () => {
    expect(bad(['x', 'y', 'z'])).toThrow(/unexpected argument z/);
    expect(bad(['x'])).toThrow(/missing <b>/);
    expect(bad([])).toThrow(/missing <a>/);
  });
  it('rejects a flag with no value, a repeated flag and a bad value', () => {
    expect(bad(['x', 'y', '--seeds'])).toThrow(/--seeds needs a value/);
    expect(bad(['x', 'y', '--seeds', '--tag', 'a'])).toThrow(/--seeds needs a value/);
    expect(bad(['x', 'y', '--seeds=', 'z'])).toThrow(/positive integer/);
    expect(bad(['x', 'y', '--seeds', '1', '--seeds', '2'])).toThrow(/given twice/);
    for (const v of ['0', '1.5', '-3', 'ten']) expect(bad(['x', 'y', '--seeds', v])).toThrow(/positive integer/);
    for (const v of ['0', '-1', 'abc', ' ']) expect(bad(['x', 'y', '--seeds-scale', v])).toThrow(/positive number/);
    for (const v of ['Scratch', 'a b', 'x/y', '-a']) expect(bad(['x', 'y', `--tag=${v}`])).toThrow(/lowercase/);
  });
  it('treats every argument after a bare -- as a positional', () => {
    expect(parseArgs(['x', '--', '--y'], SPEC).positionals).toEqual(['x', '--y']);
    expect(bad(['x', 'y', '--', '--seeds', '3'])).toThrow(/unexpected argument --seeds/);
  });
  it('reads id and seed flags, and rejects bad ones (Ruling 139 g)', () => {
    const S: CommandSpec = { name: 'search', positionals: [], flags: { archetype: 'id', budget: 'int', seed: 'seed' }, required: ['archetype', 'budget'] };
    const seed = '0123456789abcdef0123456789abcdef';
    const p = parseArgs(['--archetype', 'speed-rush-blitzr', '--budget', '5', `--seed=${seed}`], S);
    expect(tag(p, 'archetype')).toBe('speed-rush-blitzr');
    expect(tag(p, 'seed')).toBe(seed);
    for (const v of ['0'.repeat(32), seed.toUpperCase(), seed.slice(1), `${seed}0`, 'xyz']) expect(() => parseArgs(['--archetype', 'a', '--budget', '5', '--seed', v], S)).toThrow(/32 lowercase hex characters, not all zero/);
    expect(() => parseArgs(['--archetype', 'Bad', '--budget', '5'], S)).toThrow(/lowercase/);
  });
  it('rejects a missing required flag, and lists required flags unbracketed in the usage line', () => {
    const S: CommandSpec = { name: 'search', positionals: [], flags: { archetype: 'id', budget: 'int', seed: 'seed', tag: 'tag' }, required: ['archetype', 'budget'] };
    expect(() => parseArgs(['--budget', '5'], S)).toThrow(/missing --archetype\nusage: search --archetype <id> --budget N \[--seed <hex>\] \[--tag <tag>\]/);
    expect(() => parseArgs(['--archetype', 'a'], S)).toThrow(/missing --budget/);
    expect(() => parseArgs([], S)).toThrow(UsageError);
  });
  it('writes a usage line from the spec', () => {
    expect(usageLine(SPEC)).toBe('demo <a> <b> [--seeds N] [--seeds-scale k] [--tag <tag>]');
  });
});
