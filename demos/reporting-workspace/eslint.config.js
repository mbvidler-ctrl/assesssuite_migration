import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

// Workspace-local lint configuration. The repository's root configuration
// scopes itself to src/; this one mirrors its React rules for the demo app
// and applies the recommended JavaScript rules to the Node modules.

export default [
  {
    files: ['domain/**/*.mjs', 'server/**/*.mjs', 'tests/**/*.mjs', 'fixtures/**/*.mjs', 'e2e/**/*.mjs', '*.js', '*.cjs'],
    languageOptions: { globals: { ...globals.node } },
    ...pluginJs.configs.recommended,
    rules: {
      ...pluginJs.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['app/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    ...pluginJs.configs.recommended,
  },
  {
    files: ['app/**/*.{js,jsx}'],
    ...pluginReact.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
    plugins: { react: pluginReact, 'react-hooks': pluginReactHooks },
    rules: {
      ...pluginReact.configs.flat.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
