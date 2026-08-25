---
'@object-ui/plugin-detail': patch
---

`DetailSection` now resolves `section.headerColor` through a lookup of complete
Tailwind class literals instead of building `bg-` + the authored value as a
template literal (objectui#6178).

Tailwind v4 has no runtime — it builds the stylesheet by scanning source text
for complete class tokens, and this workspace ships no `bg-*` safelist — so the
old expression contributed nothing to the compiled CSS. Measured, not assumed:
compiling `apps/console/src/index.css` with that expression deleted produced a
byte-identical stylesheet (same sha256). An authored value styled the header
only when some other source file happened to author the identical class
literally, which is why both documented examples appeared to work: `bg-muted`
occurs 691 times and `bg-primary/10` 63 times elsewhere in the workspace. That
liveness was accidental and moved with unrelated edits in unrelated packages.

The shape matches the sibling this repo already solved the same way —
`useRowColor`'s `COLOR_TO_CLASS` in `@object-ui/plugin-grid`:

- a lookup of literal, tint-only design-system classes: `muted`, `muted/50`,
  `accent`, `primary/10`, `secondary/10`, `destructive/10`. Both values the
  `@object-ui/types` mirror documents (`muted`, `primary/10`) are in it, so
  nothing that rendered before renders differently now;
- a value that is already a complete `bg-*` class is passed through untouched.
  This is new — `headerColor: 'bg-muted'` previously produced the meaningless
  `bg-bg-muted`;
- anything else contributes no class at all, instead of a fabricated one.

Behaviour change to be aware of: an undocumented bare suffix outside the
vocabulary (say `headerColor: 'blue-100'`) no longer reaches the DOM as
`bg-blue-100`. It rendered before only where another file happened to author
that exact class; write it as the complete class (`headerColor: 'bg-blue-100'`)
to keep it, on the same terms as any `className` a schema carries. No value is
rejected and the declared type is unchanged.

`headerColor` remains undeclared on the strict `@objectstack/spec`
`record:details` section schema, which refuses it today on the strength of this
defect (objectstack#11661). Declaring it, and with which vocabulary, is a
separate spec decision.
