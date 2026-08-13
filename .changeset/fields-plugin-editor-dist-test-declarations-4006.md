---
'@object-ui/fields': patch
'@object-ui/plugin-editor': patch
---

`@object-ui/fields` and `@object-ui/plugin-editor` stop publishing their test declarations

Both packages' build tsconfigs set `include: ["src"]` with no test exclude, so every test file entered the declaration program and its `.d.ts` was written into `dist/`. Both are published (`private` is false, `files` contains `dist`), so those declarations shipped: 85 from `@object-ui/fields` and one from `@object-ui/plugin-editor`. Adding the test exclude the other twenty-odd packages already use removes them.

Nothing else about either artifact moves. Measured by building each package both ways from a cleared `dist/`, then diffing the file lists: `@object-ui/fields` goes from 163 files to 78 and `@object-ui/plugin-editor` from 6 to 5, every one of the 86 disappearances is a `*.test.d.ts`, no file appears, and all 83 surviving files are byte-identical by sha256 — including each package's entry `dist/index.d.ts`. The entry type surface is therefore unchanged and no import can break; this is the tarball shedding files nothing resolved.

The type coverage those files were a side effect of did not go with them. Because the build program read the tests, these two packages counted as "tests type-checked" in `scripts/check-type-check-coverage.mjs` — a correct verdict reached through an emit nobody wanted. Excluding the tests alone would have silently dropped 86 test files out of every `tsc` program, so the same change adds a `tsconfig.test.json` per package, chained from each package's `type-check` script, and the coverage gate stays at 41 of 41 packages compiling their tests with zero declared debt on both sides of the change.
