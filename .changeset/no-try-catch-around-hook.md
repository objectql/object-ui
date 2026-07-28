---
"@object-ui/i18n": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-calendar": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-designer": patch
"@object-ui/plugin-gantt": patch
"@object-ui/plugin-view": patch
"@object-ui/components": patch
---

fix(hooks): stop calling translation hooks inside try/catch (objectui#2879)

Eleven call sites wrapped a React hook in `try`/`catch` to make it
"provider-safe". `useObjectTranslation` and `useObjectLabel` already are — they
read context optionally and fall back to react-i18next's global instance, and
never throw. The `catch` bought nothing and cost correctness: a throw *after*
the hook ran desyncs hook order on the next render, because React matches hooks
positionally. objectui#2595/#2596 fixed exactly this in `@object-ui/i18n`'s
`createSafeTranslation`; nine plugin-local re-implementations kept their own
copy of the bug, and two more (`ObjectTimeline`, `ObjectView`) were found by the
new lint rule below — `ObjectView` had even suppressed
`react-hooks/rules-of-hooks` inline to keep it.

- Six exact re-implementations now delegate to `createSafeTranslation`:
  `plugin-detail`, `plugin-timeline`, `plugin-list`, `plugin-calendar`,
  `plugin-grid`'s `ObjectGrid`, `plugin-designer`.
- `components`' `data-table` also delegates; `createSafeTranslation` now
  returns `language` alongside `t` so consumers that localize dates don't need
  a second hook call. Purely additive.
- `plugin-gantt` and `plugin-grid`'s `ImportWizard` keep their local hooks —
  they fall back *per key*, which a single-probe factory cannot express and
  which their comments justify (a host dictionary that covers common keys but
  lags on newer ones). Only the `try`/`catch` is removed.
- `ObjectTimeline` and `ObjectView` call the hook directly and probe the
  returned value, mirroring `useSafeFieldLabel`.

Adds `object-ui/no-try-catch-around-hook` (error) so a twelfth copy fails CI.
It only matches `use*` names, accepts member calls solely on `React` (so
`vi.useRealTimers()` is not a hook), and resets its try-depth inside nested
functions (so `renderHook(() => useThing())` inside a `try` is fine) — both
false positives were real code in this repo and are pinned in the rule's tests.

`eslint-rules/**/*.test.js` matched no vitest project glob, so the local
plugin's specs had never run in CI. They are now included; all three pass.

`ObjectTimeline`'s test mock of `@object-ui/react` omitted `useObjectLabel` —
the removed `try`/`catch` had been silently absorbing that gap. The mock is now
complete.
