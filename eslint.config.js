import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Shared rules for any unused-var handling. The codebase deliberately ignores
// some caught errors (corrupted localStorage, quota, parse failures) with
// commented empty/no-op catch blocks, so caught errors are not flagged.
const noUnusedVars = [
  'error',
  { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
]

// Empty catch blocks are used intentionally to ignore non-critical failures
// (corrupted localStorage, storage quota, best-effort JSON parsing).
const noEmpty = ['error', { allowEmptyCatch: true }]

export default [
  { ignores: ['dist', 'node_modules'] },

  // Browser app source (React + Vite)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.2' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Hooks correctness — exhaustive-deps is what guards the localStorage
      // persistence effects against the stale-closure bug fixed in this branch.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // This project intentionally does not use prop-types (it is a small,
      // single-author app); type-checking props adds noise without value here.
      'react/prop-types': 'off',
      'no-unused-vars': noUnusedVars,
      'no-empty': noEmpty,
    },
  },

  // Node-based helper scripts
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': noUnusedVars,
      'no-empty': noEmpty,
    },
  },

  // Test files (Vitest globals)
  {
    files: ['**/*.test.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': noUnusedVars,
      'no-empty': noEmpty,
    },
  },
]
