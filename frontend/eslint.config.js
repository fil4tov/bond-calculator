import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const publicApiRestrictions = [
  { group: ['#pages/*/*', '#widgets/*/*', '#entities/*/*', '#shared/*/*'], message: 'Импортируйте модуль через его публичный index.ts.' },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/incompatible-library': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-imports': ['error', { patterns: publicApiRestrictions }],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...publicApiRestrictions, { group: ['#app', '#app/*', '#pages', '#pages/*'], message: 'Страница не может импортировать app или соседнюю страницу.' }] }],
    },
  },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...publicApiRestrictions, { group: ['#app', '#app/*', '#pages', '#pages/*', '#widgets/*'], message: 'Widget использует только entities и shared.' }] }],
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...publicApiRestrictions, { group: ['#app', '#app/*', '#pages', '#pages/*', '#widgets/*'], message: 'Entity использует только entities и shared.' }] }],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...publicApiRestrictions, { group: ['#app', '#app/*', '#pages', '#pages/*', '#widgets/*', '#entities/*'], message: 'Shared не зависит от бизнес-слоёв.' }] }],
    },
  },
);
