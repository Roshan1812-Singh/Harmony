import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// No-op rule so that inline `eslint-disable` comments referencing plugin rules
// (provided by `next lint`) don't error when linting from the repo root.
const noopRule = { create: () => ({}) };

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/build/**',
      '**/android/**',
      '**/mobile-shell/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/*.config.ts',
      '**/*.d.ts',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts,tsx}'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-constant-binary-expression': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-constant-condition': 'off',
      'no-case-declarations': 'off',
      'no-prototype-builtins': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': { rules: { 'no-img-element': noopRule } },
      'react-hooks': { rules: { 'exhaustive-deps': noopRule, 'rules-of-hooks': noopRule } },
    },
  },
);
