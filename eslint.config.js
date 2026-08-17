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
    // objectui#4835 — this repo already writes a leading `_` to mean "declared
    // on purpose, deliberately unused", but only `argsIgnorePattern` was set,
    // so the rule honoured that convention for FUNCTION PARAMETERS and for
    // nothing else. Measured on origin/main @ 378dc920b (#4806, re-measured in
    // this PR): 822 no-unused-vars warnings, 613 of them (74.6%) on names the
    // author had already marked `_`. The two dominant populations are
    // legitimate constructs rather than dead code — 442 type-level assertions
    // in tests (`type _NotAny = Assert< ... >`, erased before anything runs, so
    // "unused" is what a passing pin looks like) and the deliberate-omit
    // destructuring idiom. `caughtErrors` defaults to `'all'` in
    // typescript-eslint v8, so `catch (_e)` was reported too. The two patterns
    // added below close that gap; they do not weaken the rule, and severity
    // stays `warn` — `.github/workflows/lint.yml` sets no `--max-warnings`, so
    // this rule could not fail CI before and cannot now (errors 0 -> 0,
    // no-unused-vars 822 -> 209).
    //
    // `ignoreRestSiblings` is deliberately LEFT at its `false` default, so
    // `const { a, ...rest }` still reports `a`. It is a different mechanism
    // from the `_` convention, not an extension of it: it exempts every
    // rest-sibling by SYNTAX whatever it is named, so a property someone simply
    // forgot to use is silenced with nothing declared at the site. Measured:
    // 194 findings sit next to a rest element and 155 of them (80%) are ALREADY
    // spelled `_` — that idiom is what this codebase actually uses (see
    // packages/plugin-view/src/ObjectView.tsx and
    // packages/components/src/renderers/action/action-bar.tsx), and the
    // patterns below already cover all 155. The 39 left over carry no `_`, and
    // 20 of those are function PARAMETERS — exempting them by syntax would open
    // a second, undeclared path around the `argsIgnorePattern` convention this
    // very config states. Turning it on is a separate decision with its own
    // trade-off; see objectui#4835.
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    // objectui#4029 — importing a package must not write noise to the
    // consumer's console. House convention (measured, not invented): the
    // one known leak used `console.log`, while every deliberate diagnostic
    // already used `warn`/`error` (packages/plugin-map/src/ObjectMap.tsx,
    // packages/core/src/registry/Registry.ts). Error so a new module/
    // function-scope `console.log`/`info`/`debug` fails CI instead of
    // waiting for a human read; `warn`/`error` stay allowed for intentional
    // diagnostics. See the override block below for the carve-outs a blanket
    // rule needs (CLI stdout, per-package examples, deliberate debug/logger
    // infrastructure) and eslint.config.js's own PR history for the full
    // hit-census accounting behind each one.
    'no-console': ['error', { allow: ['warn', 'error'] }],
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
    // objectui#4734 ratchet — `find(obj, { options: { $top: 100 } })`. The
    // paging/filter keys are declared at the TOP level of `QueryParams`, no
    // adapter reads `params.options`, and `QueryParams`'s deliberate
    // `[key: string]: any` means the misplaced spelling type-checks exactly as
    // well as the correct one — so nothing rejected it. Two blocks shipped it
    // (object-timeline, objectui#4009/objectstack#7137; object-kanban,
    // objectui#4025) and each fetched every row the server would return, a
    // symptom that reads as a data problem rather than a code problem. Error so
    // the next one fails at write time; the repo is at zero live instances, so
    // this lints clean today with no allowlist. Unscoped on purpose: the
    // signature needs no exemptions — 47 legitimate `options` objects exist
    // repo-wide and not one carries a `$`-prefixed key.
    'object-ui/no-query-params-under-options': 'error',
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
  // objectui#4029 — no-console exemption zones. None of these are "a
  // package's console" from a consumer's perspective:
  //  - root scripts/** is repo tooling that runs standalone, never as part
  //    of a published package's import graph.
  //  - examples/** at ANY depth (root AND per-package, hence **/ prefix —
  //    measured objectui#4029: packages/types/examples/*.ts alone carried 18
  //    hits the root-anchored examples/** glob never reached) is
  //    documentation code, not a runtime import surface.
  //  - test files assert against console output themselves (spying on it)
  //    rather than leaking it to a real consumer.
  //  - packages/cli and packages/create-plugin are CLI tools whose entire
  //    job is terminal stdout/stderr — running a bin is not "importing a
  //    package and getting noise you didn't ask for". @object-ui/cli's
  //    index.ts does re-export a couple of commands for programmatic use,
  //    but their console output is the documented behavior of calling them,
  //    not an accidental module-scope leak — the #7139 bug class this rule
  //    exists to net.
  files: [
    'scripts/**/*.{ts,tsx}',
    '**/examples/**/*.{ts,tsx}',
    '**/*.test.{ts,tsx}',
    '**/__tests__/**/*.{ts,tsx}',
    'packages/cli/src/**/*.{ts,tsx}',
    'packages/create-plugin/src/**/*.{ts,tsx}',
  ],
  rules: {
    'no-console': 'off',
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
