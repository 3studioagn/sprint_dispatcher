import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import promisePlugin from 'eslint-plugin-promise';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importPlugin,
      promise: promisePlugin,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [{ pattern: '@sprint/**', group: 'internal', position: 'before' }],
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',

      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/prefer-await-to-then': 'error',

      // TODO [BL-C8-005]: regra customizada proibindo imports diretos entre apps/*
      // sera adicionada quando os apps existirem (sessao futura, componente C8).
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig,
);
