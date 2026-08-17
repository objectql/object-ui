---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/sdui-parser': minor
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
---

`ComponentInput.type` can declare a UNION, so a block stops warning about legal
writes its own description recommends

A registration's `type` was one coarse control kind, while a good number of spec
keys accept more than one shape. A declaration therefore had to pick an arm, and
the repo's own manifest gate then reported `type-mismatch` on the other arm's
legal values. Four of the five measured cases were the loud shape: the input's
`description` teaches the author to write an inline translation map
(`{ en, "zh-CN", … }`) while the same input's `type: 'string'` made
`sdui-parser`'s `checkType` warn about exactly that map — one platform authority
contradicting itself on the write it had just recommended. Because these land at
warning severity the page still compiled and rendered; the cost is that noise on
correct authoring trains authors, AI authors included, to dismiss the
`unknown-prop` and `type-mismatch` reports that are real.

`type` now accepts an ARRAY of coarse kinds as well as a single one (maintainer
ruling on objectui#3832, direction (a)), and a value passes the coarse check when
ANY declared arm accepts it. Both declaration sites in `@object-ui/types` move
together with the registry's own copy in `@object-ui/core`, and
`ComponentInputSchema` enforces the same widening — a non-empty array of
DISTINCT kinds, so an empty arm list or a repeated arm is refused at authoring
time rather than normalized behind the author's back.

Five declarations now spell their real contract, and the `type-mismatch` warning
on each of these legal writes is gone:

- `page:header.title`, `page:header.subtitle`, `page:card.title` —
  string **or** inline translation map (the spec's union, measured against
  `ComponentPropsMap` at the pinned rc.6; the renderers resolve both through
  `pickLocalized`);
- `record:alert.title`, `record:alert.body` — the same two shapes, justified
  against the RENDERER since the pinned spec carries no `record:alert` props
  schema;
- `element:text_input.defaultValue` — `string | number`, the spec's union,
  which had been narrowed to `'string'` with the number arm named only in prose.

**Backward compatible, and measured as such.** The single-kind form stays valid
and is still the canonical spelling for a one-arm key: it validates identically
(the diagnostics for one arm, `invalid-enum` and its `error` severity included,
are byte-identical), and `manifestFromConfigs` collapses a one-element array back
to the bare string, so every entry already in a published `sdui.manifest.json`
serializes unchanged and arrays appear only where a union was really declared.
The JSX authoring surface follows in the same step — `generateDts` emits a
TypeScript union for a union input, so the `.d.ts` an author type-checks against
accepts exactly what the gate accepts.

A union widens what is legal; it does not switch the check off. A value matching
NO declared arm is still reported, a multi-arm mismatch reports at its strictest
arm's severity (`error` when an `enum` arm is present, so an enum's closed list
does not become dismissible by having a second arm added next to it), and arms
are meant to match the contract rather than relax the gate:
`element:text_input.defaultValue` deliberately gains no `object` arm because the
spec rejects a map there, and `element:record_picker.emptyText` keeps its single
`'string'` arm because that renderer drops the map form (objectui#4163) — an arm
the renderer never honours would advertise a shape that cannot reach the screen.
