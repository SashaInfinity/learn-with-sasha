import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/**', // backend has its own lint config
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base JS recommendations
  js.configs.recommended,

  // TypeScript recommendations (type-aware rules off for speed)
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        process: 'readonly', // Vite stubs process.env.API_KEY at build time
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      // React
      'react/jsx-uses-react': 'off', // react-jsx runtime
      'react/react-in-jsx-scope': 'off', // react-jsx runtime
      'react/prop-types': 'off', // TS handles this
      'react/jsx-key': 'warn',
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript — relax a few that are noisy during migration
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // General
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Turn off all rules that conflict with Prettier formatting
  prettier,
);
