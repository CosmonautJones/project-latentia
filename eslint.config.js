import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ALLOWED_MATH = 'floor|abs|min|max|trunc|imul';

const bans = {
  exponent: {
    selector: "BinaryExpression[operator='**']",
    message: '`**` is banned in engine code (integer-only arithmetic).',
  },
  exponentAssign: {
    selector: "AssignmentExpression[operator='**=']",
    message: '`**=` is banned in engine code (integer-only arithmetic).',
  },
  forIn: {
    selector: 'ForInStatement',
    message: '`for...in` is banned in engine code (non-deterministic key order risk).',
  },
  math: {
    selector: `MemberExpression[object.name='Math']:not([property.name=/^(${ALLOWED_MATH})$/])`,
    message: `Only Math.${ALLOWED_MATH.split('|').join(', Math.')} are allowed in engine code.`,
  },
  divide: {
    selector: "BinaryExpression[operator='/']",
    message: '`/` is banned outside src/math/ (use the integer helpers).',
  },
  divideAssign: {
    selector: "AssignmentExpression[operator='/=']",
    message: '`/=` is banned outside src/math/ (use the integer helpers).',
  },
};

const engineGlobals = ['Date', 'performance', 'Intl'].map((name) => ({
  name,
  message: `\`${name}\` is banned in engine code (determinism).`,
}));

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.superpowers/**', 'packages/engine/test/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...engineGlobals],
      'no-restricted-properties': [
        'error',
        { property: 'localeCompare', message: '`localeCompare` is banned in engine code (locale-dependent).' },
      ],
      'no-restricted-syntax': [
        'error',
        bans.exponent,
        bans.exponentAssign,
        bans.forIn,
        bans.math,
        bans.divide,
        bans.divideAssign,
      ],
    },
  },
  {
    files: ['packages/engine/src/math/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', bans.exponent, bans.exponentAssign, bans.forIn, bans.math],
    },
  },
);
