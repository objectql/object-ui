---
---

Releases nothing on purpose: `@object-ui/plugin-map` now type-checks its four test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. No
published source changed.

Its one declared code-tier error turned out to be config-tier under a fuller template,
the same reclassification `sdui-parser`'s 50 `TS2304`s got in objectui#3032. The error was
`TS2882` on `ObjectMap.tsx`'s side-effect import of `maplibre-gl/dist/maplibre-gl.css` —
raised not because the source is wrong (the package build compiles it cleanly) but because
`src/global.d.ts`, which declares `*.css`, was not a program input. An ambient declaration
file is only an input when a pattern NAMES it; being reachable by import is not enough,
since nothing imports it. `"src/**/*.d.ts"` in the project's `include` is the fix, and it
is the general shape for any package whose build gets ambient declarations for free from
`"include": ["src"]`.
