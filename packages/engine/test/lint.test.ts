import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const engineSrc = resolve(here, '../src');
const eslint = new ESLint({ cwd: repoRoot });

async function errorCount(fixture: string, asIfAt: string): Promise<number> {
  const code = readFileSync(resolve(here, 'fixtures/lint', fixture), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: resolve(engineSrc, asIfAt) });
  return result?.errorCount ?? -1;
}

describe('engine lint bans (linted as src/battle/x.ts)', () => {
  const banned = [
    'math-random.ts',
    'exponent.ts',
    'exponent-assign.ts',
    'math-sqrt.ts',
    'date.ts',
    'for-in.ts',
    'locale-compare.ts',
    'divide-assign.ts',
    'divide.ts',
  ];
  for (const fixture of banned) {
    it(`${fixture} reports at least one error`, async () => {
      expect(await errorCount(fixture, 'battle/x.ts')).toBeGreaterThanOrEqual(1);
    });
  }

  it('allowed Math members report no errors', async () => {
    expect(await errorCount('allowed-math.ts', 'battle/x.ts')).toBe(0);
  });
});

describe('src/math/ exemptions', () => {
  it('division is allowed in src/math/', async () => {
    expect(await errorCount('divide.ts', 'math/x.ts')).toBe(0);
  });
  it('/= is allowed in src/math/', async () => {
    expect(await errorCount('divide-assign.ts', 'math/x.ts')).toBe(0);
  });
  it('** is still banned in src/math/', async () => {
    expect(await errorCount('exponent.ts', 'math/x.ts')).toBeGreaterThanOrEqual(1);
  });
});
