---
---

Repo tooling and build config only — no published package changes, so no version bump.

Published build tsconfigs must now exclude tooling DIRECTORIES, not just tooling FILE NAMES,
and a new per-PR gate enforces it: `pnpm check:published-tsconfig-exclude`
(`scripts/check-published-tsconfig-tooling-exclude.mjs`, wired into `ci.yml`'s Type Check job).

The same defect had been repaired three times and gated never — objectui#4006 (73 `*.test.d.ts`
published from two packages), objectui#4836 (9 more, one of them an emitted module whose first
statement imports `vitest`) and objectui#6943 (the same package as the first, because that fix
wrote the name form and the directory form was never generalised). objectui#7212 measured the
standing exposure instead of another instance: 29 published packages carried the name form with
ZERO offending files, green because nobody had yet added a shared helper to a `__tests__/`
directory, not because the config would stop one. The maintainer ruled for the ratchet on
2026-09-02.

The gate reads `exclude` arrays and nothing else — no build, no artifact, no emit model. That
narrowness is the point: objectui#4846 measured the cheap static gate "no build tsconfig program
may contain a tooling file" and rejected it, because deciding whether a tooling file in a program
is a defect means reimplementing three third-party emit semantics. Asking only DOES THE CONFIG
NAME THE DIRECTORY needs none of that. The artifact-level `pnpm check:published-dist` is
untouched and stays the second line of defence — it is the only criterion that cannot be wrong
about what actually ships.

28 build tsconfigs were converted in the same commit so `main` is green on merge. The conversion
is emit-neutral, and that was measured rather than assumed: each package's build program file
list was resolved with TypeScript's own config resolver before and after, and all 33 enforced
packages came back byte-identical (0 files added, 0 removed). Identical program input means
identical emit, so no published artifact and no bundle moves.

Six published packages are named carve-outs rather than converted, because their emitter never
builds its program from this file list, and each re-proves its own reason on every run instead of
being trusted: `@object-ui/cli`, `@object-ui/create-plugin` and `@object-ui/data-objectstack` emit
from a `tsup` entry graph; `@object-ui/plugin-charts` keeps its tooling exclude in the `dts()`
options and carries no `exclude` key in its tsconfig; `@object-ui/console` and `@object-ui/runner`
are Vite applications with `noEmit: true` and no `dts()` plugin, so they write no declarations at
all. Two of those six — `create-plugin` and `runner` — were found at authoring time and were
inside the ruling's initial red set; requiring a shape in a config their emitter never consults
would have been a check that is green about nothing.
