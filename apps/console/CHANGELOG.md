# @object-ui/console

## 5.1.0

### Patch Changes

- 32306e8: chore: bump `@objectstack/client` and `@objectstack/cli` to `^4.2.0`

  Brings in the published Optimistic Concurrency Control surface
  (`If-Match` header on `data.update`/`data.delete`, `409
CONCURRENT_UPDATE` response shape with `currentVersion` /
  `currentRecord`) so the inline-edit save path can actually push the
  `ifMatch` token through.

## 5.0.2

## 5.0.1

## 5.0.0

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

### Patch Changes

- 1909bc3: Add `transformSpecTranslations` / `isSpecTranslationData` helpers to
  `@object-ui/i18n` so apps no longer need to maintain their own copy of the
  `@objectstack/spec` `TranslationData` → flat namespace transform.

  The new transform preserves **every** `_`-prefixed object scope by
  convention (`_views`, `_actions`, `_sections`, `_notifications`, `_errors`,
  `_options`, plus anything added in future spec versions), which fixes a
  class of silent-failure regressions where new spec scopes were dropped
  during transformation — leaving e.g. list-view labels to fall back to the
  untranslated source string.

  `@object-ui/console`'s `loadLanguage.ts` is rewritten to delegate to the
  shared helper.

## 4.0.10

## 4.0.9

### Patch Changes

- 19c044f: i18n

## 4.0.8

## 4.0.7

### Patch Changes

- 7c9b85c: Fix compatibility with the framework's normalized Expression envelope format.

  `@objectstack/spec` now emits predicate (`visible` / `enabled`) and template
  (`titleFormat`) fields as `{ dialect, source }` envelopes instead of bare
  strings. The previous implementation assumed strings and crashed the record
  detail view (`TypeError: titleFormat.replace is not a function`) and printed
  `Failed to evaluate expression: ${[object Object]}` for every action visibility
  predicate.
  - `@object-ui/core`: `ExpressionEvaluator.evaluate` / `evaluateCondition` now
    unwrap Expression envelopes transparently.
  - `@object-ui/react`: new `toPredicateInput()` helper to safely normalize
    `boolean | string | Expression` predicate inputs into the `${expr}` form
    expected by `useCondition`.
  - `@object-ui/components`: `action-bar`, `action-button`, `action-group`,
    `action-icon`, `action-menu` renderers use `toPredicateInput()` instead of
    template-literal interpolation that produced `${[object Object]}`.
  - `@object-ui/plugin-detail`, `@object-ui/plugin-kanban`,
    `@object-ui/plugin-calendar`, `@object-ui/app-shell`,
    `@object-ui/console`: title-format helpers accept both legacy strings and
    the new `{ source }` envelope.

  All changes are backward-compatible — legacy bare strings continue to work.

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

## 4.0.1

### Patch Changes

- f3bc42e: fix console

## 4.0.0

## 3.4.0

## 3.3.2

### Patch Changes

- 89a7b21: fix i18n

## 3.3.1

### Patch Changes

- db7a418: fix(console): respect Vite `BASE_URL` when redirecting after a workspace
  switch. The post-switch redirect previously hardcoded `/console/home`,
  which broke deployments served from a different base path (e.g. Vercel,
  where the console is mounted at `/`). It now derives the target from
  `import.meta.env.BASE_URL`, so it works both behind `HonoServerPlugin`
  (`/console/home`) and on standalone deployments (`/home`).

## 3.3.0

## 3.2.0

### Minor Changes

- 91a9103: upgrade objectstack ai service

## 3.1.5

## 3.1.4

### Patch Changes

- 7129017: fix

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

### Patch Changes

- e1267d2: fix: re-attach listViews to object metadata stripped by defineStack() Zod parse

## 3.0.2

### Patch Changes

- f1c2fc1: fix build

## 3.0.1

## 3.0.0

### Major Changes

- Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer
