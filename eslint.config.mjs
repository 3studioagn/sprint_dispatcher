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
      '**/dist-electron/**',
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
    },
  },
  // === Sprint Dispatcher — regras especificas do projeto [BL-C8-005] ===
  // Leader: proibido importar de Agent (separacao por componente) e
  // imports relativos para packages/* (forca uso do alias @sprint/<pkg>).
  // Cross-app: aplicado tambem a tests (zero razao legitima para violar).
  // Patterns combinados em uma regra: ESLint flat config sobrescreve
  // rules em blocos seguintes ao inves de fazer merge dos patterns.
  {
    files: ['apps/leader/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/operator-agent/**', '**/sprint-operator-agent/**'],
              message:
                'Leader nao pode importar de Agent. Compartilhe via @sprint/contracts ou @sprint/fs-adapter.',
            },
            {
              group: [
                '**/packages/contracts/**',
                '**/packages/fs-adapter/**',
                '**/packages/logger/**',
              ],
              message: 'Use alias @sprint/<package> em vez de caminho relativo.',
            },
          ],
        },
      ],
    },
  },
  // Agent: proibido importar de Leader; mesma regra para packages/*.
  {
    files: ['apps/operator-agent/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/leader/**', '**/sprint-leader/**'],
              message:
                'Agent nao pode importar de Leader. Compartilhe via @sprint/contracts ou @sprint/fs-adapter.',
            },
            {
              group: [
                '**/packages/contracts/**',
                '**/packages/fs-adapter/**',
                '**/packages/logger/**',
              ],
              message: 'Use alias @sprint/<package> em vez de caminho relativo.',
            },
          ],
        },
      ],
    },
  },
  // Packages internos: nao podem se referenciar via caminho relativo
  // entre si (use sempre @sprint/<pkg>).
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/packages/contracts/**',
                '**/packages/fs-adapter/**',
                '**/packages/logger/**',
              ],
              message: 'Use alias @sprint/<package> em vez de caminho relativo.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Scripts de build/release na raiz (@sprint/release-tools): JS puro (.mjs)
  // executado por `node`, fora do programa TypeScript dos workspaces — sem
  // type-checking (mesmo tratamento dos *.config.*, evita "not found by the
  // project service", G-010). `console` liberado: são CLIs de release que
  // reportam progresso no stdout/stderr.
  {
    files: ['scripts/**/*.{js,cjs,mjs}', 'apps/*/scripts/**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'no-console': 'off',
    },
  },
  prettierConfig,
);
