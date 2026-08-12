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
import objectUi from './eslint-rules/index.js'

export default tseslint.config({
  ignores: [
    '**/dist',
    '**/.next',
    '**/node_modules',
    '**/public',
    // fumadocs-mdx codegen for apps/site (gitignored — see apps/site/.gitignore).
    // Linting generated output only reports on the generator's choices.
    '**/.source',
  ],
}, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'object-ui': objectUi,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Downgrade new React Compiler rules to warnings (codebase predates these rules)
    'react-hooks/refs': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
    'react-hooks/use-memo': 'warn',
    // ADR-0054 Phase 5 ratchet — ban synthetic-event triggers (C1). Error so a
    // new violation fails CI; the existing surfaces were converted to direct
    // idempotent commands first, so this lints clean today.
    'object-ui/no-synthetic-event-trigger': 'error',
    // objectui#2879 ratchet — a hook called inside try/catch desyncs hook order
    // when the catch swallows a throw. #2595/#2596 fixed this in the canonical
    // createSafeTranslation; nine plugin-local copies kept it until #2879.
    // Error so a tenth copy fails CI; all known sites were converted first, so
    // this lints clean today.
    'object-ui/no-try-catch-around-hook': 'error',
    // objectui#3090 tripwire — the spec's FormField/FormFieldSchema are the
    // form-VIEW vocabulary (`field` = object-field reference), a DIFFERENT
    // layer from objectui's runtime form-field contract (`name` = data path);
    // the translation point is `normalizeSectionField` in @object-ui/
    // plugin-form. Worse, the spec's FormField TYPE erases to `any` in its
    // dist (objectstack#4171), so importing it here silently deletes type
    // safety — tsc says nothing. Error so the misimport fails at write time,
    // with this message as the correction.
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@objectstack/spec/ui',
        importNames: ['FormField', 'FormFieldSchema'],
        message:
          'This is the spec form-VIEW vocabulary (field = object-field reference), and its type erases to ' +
          '`any` (objectstack#4171) — importing it silently deletes type safety. The runtime form-field ' +
          'contract is `FormField`/`FormFieldSchema` from @object-ui/types; the two layers meet only in ' +
          '`normalizeSectionField` (@object-ui/plugin-form). See objectui#3090.',
      }],
    }],
  },
}, {
  // objectui#3010/#3021 ratchet — a module loaded inside beforeAll/beforeEach
  // bills its cold Vite transform to `hookTimeout`, so the test passes or fails
  // on machine load. Raising the timeout is the intuitive fix and it does not
  // work: all 37 files found this way already had a raised timeout, escalating
  // 15s -> 30s -> 60s, and plugin-kanban blew its raised 15s anyway at 15021ms.
  // Scoped to test files — a dynamic import in app code is normal code
  // splitting. Error so a new one fails CI; every existing site was converted
  // first, so this lints clean today.
  files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
  plugins: { 'object-ui': objectUi },
  rules: {
    'object-ui/no-dynamic-import-in-test-hook': 'error',
  },
}, {
  // objectui#4045 ratchet — a `<button>` with no `type` is `type="submit"` per
  // HTML, so it submits any <form> it is composed into instead of running its
  // own handler. In an SDUI renderer that composition is a JSON metadata
  // decision made far from the button's own file, so "not in a form today" is
  // the dormancy, not a defence. Three per-instance rounds (objectui#3344,
  // objectstack#5236, objectstack#6952) each fixed the sites in view and left
  // the rest; nothing rejected the next one at write time, because `type` is
  // optional in React's ButtonHTMLAttributes. Error so the next one fails CI;
  // the whole population was converted first, so this lints clean today.
  //
  // Ignores mirror the population's counting rules exactly (objectui#4045):
  //  - `src/ui/**` is the upstream Shadcn zone, overwritten by the sync script
  //    and never hand-edited (AGENTS.md #7) — enforcing there would demand an
  //    edit the repo forbids.
  //  - test files render buttons into a test DOM, never into a product form,
  //    and their fixtures are deliberately minimal.
  files: ['**/*.tsx'],
  ignores: ['**/src/ui/**', '**/*.test.tsx', '**/__tests__/**'],
  plugins: { 'object-ui': objectUi },
  rules: {
    'object-ui/button-has-type': 'error',
  },
}, {
  // Type-discipline ratchet, scoped to the canonical view-schema file: a
  // spec-backed view-config field must reference its @objectstack/spec type,
  // never redefine it inline (a hand mirror silently drifts from the spec →
  // "shipped-but-inert" metadata). Scoped here to avoid false positives on
  // unrelated `selection`/`pagination`/… fields elsewhere. Error so a new
  // inline mirror fails CI; the covered fields were converted first, so this
  // lints clean today.
  files: ['packages/types/src/objectql.ts'],
  plugins: { 'object-ui': objectUi },
  rules: {
    'object-ui/no-inline-spec-config': 'error',
  },
});
