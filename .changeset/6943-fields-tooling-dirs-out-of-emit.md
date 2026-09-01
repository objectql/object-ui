---
'@object-ui/fields': patch
---

Stop shipping `dist/__tests__/numberInputBrowserReadings.d.ts` in the published tarball
(objectui#6943). `packages/fields/tsconfig.json` now excludes the tooling DIRECTORIES
(`__tests__`, `__mocks__`, `__benchmarks__`), not just the `*.test.*` NAME.

`numberInputBrowserReadings.ts` holds the measured Chromium/happy-dom readings the number
widget suites share. It is deliberately not a `*.test.ts` — it carries no assertions — so
the name-only exclude list did not catch it, and it was emitted into `dist` and published
while its 79 neighbours in the same directory were kept out. That made
`check:published-dist` red on `main`, and because the same script is the first link in
`changeset:publish`, it also failed the publish command at its first step.

This is the third instance of the same name-versus-directory mismatch (objectui#4006 here,
objectui#4836 in plugin-grid / plugin-view / plugin-designer), so the exclude table is now
the directory convention itself rather than a list of names to extend.

Which program had to be fixed was measured rather than assumed, because this package's
build is `tsc && vite build` and the `tsc` leg inherits the root's `noEmit`: run alone the
`tsc` leg exited 0 and wrote zero files, while `vite build` alone produced the whole
81-file output including the offending declaration. vite-plugin-dts is the emitting
program, and it builds its declaration program from this package's `tsconfig.json`, so
that is where the exclude belongs.

No type coverage moves with the change and no API surface moves: `numberInputBrowserReadings.ts`
is the only file the directory patterns newly remove from the build program, and the
`tsconfig.test.json` chained off `type-check` already reads it as a transitive input of the
three suites that import it. The name patterns stay, because 52 `*.test.ts(x)` files in this
package sit outside any `__tests__/` directory.
