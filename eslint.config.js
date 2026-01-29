// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config({ ignores: ['**/dist', '**/.next', '**/node_modules', '**/public'] }, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    // This rule checks for calling impure functions (like Math.random) during render
    // eslint-plugin-react-hooks@7.x includes this purity check
    'react-hooks/purity': 'warn',
  },
}, ...storybook.configs["flat/recommended"], {
  files: ['**/*.stories.{ts,tsx,js,jsx}'],
  rules: {
    // Disable the renderer packages rule as we're using @storybook/react in stories
    'storybook/no-renderer-packages': 'off',
  },
});
