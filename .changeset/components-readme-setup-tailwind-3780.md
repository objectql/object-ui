---
---

`packages/components/README.md` §Setup drops the Tailwind 3 configuration step and
corrects the stylesheet specifier (objectui#3780).

Step 1 told readers to write a `tailwind.config.js` with a `content` array covering
`./node_modules/@object-ui/components/**`. This package is Tailwind 4: it has no such
file, `postcss.config.js` loads `@tailwindcss/postcss`, and `src/index.css` opens with
`@import 'tailwindcss'` plus `@theme` / `@custom-variant` / `@source`. Tailwind 4 does not
load a config file unless the CSS opts in with `@config`, so a reader who followed step 1
created a file nothing reads. objectui#3750 had already narrowed the peer line two lines
above it from `^3.0.0` to `^4.2.1`; the prose underneath did not move with it.

Measured against the built package rather than translated on sight, because the step's
premise turned out to be unreachable in Tailwind 4 and not merely misspelled. Four
consumer-shaped CSS entries, one Tailwind 4.3.3 PostCSS run each, against the real
`@object-ui/components` install:

| consumer entry | consumer's own class | library shape utilities | library theme utilities |
| --- | --- | --- | --- |
| step 1 verbatim (config file, no `@config`) | present | absent | absent |
| `@source` into the installed package | present | present | absent |
| step 1 plus an explicit `@config` opt-in | present | present | absent |
| the prebuilt stylesheet | not its job | present | present |

Neither faithful translation of step 1 reaches what step 1 was for. `bg-primary`,
`bg-background`, `border-input` and `ring-ring` — the whole Shadcn palette — exist only
where the `@theme` block that declares their tokens is compiled, and that block is in
`src/index.css`, which `files` does not publish. Scanning the published files therefore
regenerates the shape-only utilities (`inline-flex`, `rounded-md`, `h-9`) and can never
recover the themed ones, so a rewritten `@source` step would have been a new wrong
instruction rather than a fixed one. The step is deleted, and the paragraph that replaces
it says why the `@source` line a reader might reach for next is not the answer either.

What the prebuilt stylesheet covers was measured the same way instead of assumed: every
class-shaped token in `dist/index.js` + `dist/index.umd.cjs` — the entire surface a
`node_modules` glob could ever see — was compiled against this package's own theme, and
all 1331 rules that produces are already among the 1410 in the shipped `dist/index.css`.
Zero missing. The prebuilt stylesheet is a strict superset of what scanning could add.

The surviving import step also had the wrong specifier. It read
`@object-ui/components/dist/style.css`, a subpath the manifest's `exports` map does not
define — Node resolves it to `ERR_PACKAGE_PATH_NOT_EXPORTED`, and no such file is built
(`dist/index.css` is). The exported spelling is `@object-ui/components/style.css`, which is
what the three package demos, `content/docs/guide/quick-start.md` and the comment in
`src/index.ts` that points readers at this README have all used the whole time. It is now
what the README says too, shown together with the `@import 'tailwindcss'` line above it so
the order that makes the theme tokens win is visible.

No package is declared: nothing published changes shape, no version literal moves, and the
corrected README ships with the group's next release. The peer-line block two lines above
§Setup is untouched, so `doc-version-claims.test.ts`'s restatement assertion keeps reading
the same line against the same manifest.
