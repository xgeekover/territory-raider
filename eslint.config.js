import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Build outputs are not ours to lint.
  { ignores: ['dist', 'dist-electron', 'release', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Renderer (React + Canvas) — browser environment.
  // Only the two stable, battle-tested hook rules are enabled. react-hooks v7's
  // `recommended` also ships experimental React-Compiler rules (e.g.
  // `react-hooks/refs`) that false-positive on the accepted "latest ref" and
  // external-store patterns this engine integration deliberately uses; this app
  // does not opt into the compiler, so those are intentionally left off.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Electron main/preload — Node environment.
  {
    files: ['electron/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Tests — Node + Vitest globals via imports; allow non-null assertions in setup.
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Build/dev scripts and config files run under Node.
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // CommonJS scripts (Electron entries) — require/__dirname are the idiom.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
