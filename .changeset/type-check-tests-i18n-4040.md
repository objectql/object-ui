---
---

Releases nothing on purpose: `@object-ui/i18n` now type-checks its 38 test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. Only
test sources changed; no published behaviour, and no public type, moved.

The entry declared 13 errors; the real count at this branch point is **103**, because
`main` has moved a long way since that sweep and the package's test tree roughly doubled.
Two shapes account for all of them, and both are the "test tells the compiler less than
the code" class:

- **90 x TS7053** — `Object.keys(builtInLocales)` erases which keys it enumerated, so
  `builtInLocales[lang]` was an implicit-`any` index into a `const` map. Every locale
  parity, namespace and residue suite was therefore comparing packs the compiler never
  confirmed exist, and a mistyped locale code would have read `undefined` and been
  asserted against rather than failing. All of it is now derived from the map itself
  (`type LocaleCode = keyof typeof builtInLocales`) — the convention three sibling files
  in this same directory already used — so a locale added to or removed from
  `builtInLocales` reaches these suites for free.
- **12 x TS2769** — every `React.createElement(I18nProvider, { … }, children)` wrapper.
  `I18nProviderProps.children` is required and React's `createElement` overloads check
  the props object alone, so the variadic children argument never satisfied them.
  `children` moves into the props object; identical at runtime.

One straggler, `TS2537`: a fixture cast through `SpecTranslationData['objects'][string]`,
where `objects` is optional and so cannot be indexed. `NonNullable< … >` names the record
the fixture is one entry of.

Case count is unchanged either side of the change — 38 files, 662 tests, before and
after — which is the assertion that matters when twenty files' parametrised lists were
re-typed at once.
