---
'@object-ui/types': patch
---

`@object-ui/types` stops publishing its `src/` tree

Its manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 91 source files. Unlike the two sibling packages already fixed (`@object-ui/data-objectstack` #4847, `@object-ui/fields` #4856), this one was not a mechanical delete: `packages/types/tsconfig.json` built with a bare `tsc` and `declarationMap: true`, and its shipped `dist/*.d.ts.map` named `sources: ["../src/*.ts"]` with `sourcesContent: false` — a real, if small, consumer (editor go-to-source). Deleting `src` from `files` while that map still pointed at it would have shipped a tarball with a broken-link map.

Maintainer ruling (2026-08-17, objectui#4851): turn `declarationMap` off at the source rather than keep a permanent per-package exception in the phantom-dependencies gate's header, or add `inlineSources` (which saves nothing and adds a third emitter shape). `types` is a pure-types package built by bare `tsc`, so its `.d.ts` is near-isomorphic to its source — go-to-source degrading to the `.d.ts` is a near-zero-pull, deliberate trade.

Order followed: flipped `declarationMap: false` in `packages/types/tsconfig.json` first, clean-rebuilt, and confirmed the published `dist` has zero `.map` files, zero `sourceMappingURL` occurrences, and zero `../src` references (a positive control against the pre-flip build showed 54 of each, so the greps are exercised, not vacuous) — only then trimmed `files` to `["dist", "README.md", "CHANGELOG.md", "LICENSE"]`.

`npm pack --dry-run` across the change, on the freshly rebuilt `dist`:

| | before | after |
| --- | --- | --- |
| entries | 203 | 112 |
| unpacked | 3974143 B | 2828454 B |
| tarball | 656307 B | 414644 B |

91 `src/*.ts` files leave, none arrives; the `dist/` entry count (108) is unchanged, and its `.d.ts` payload is now map-free.
