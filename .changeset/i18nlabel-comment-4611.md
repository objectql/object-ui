---
'@object-ui/types': patch
---

`ActionParam`'s doc block no longer claims that spec 17 narrowed `I18nLabel` to a
plain string (objectui#4611).

The paragraph explaining why `label` / `options[].label` are inherited rather than
locally overridden justified itself with a claim about `@objectstack/spec` that was
never true: "in spec 17 `I18nLabelSchema` is `z.ZodString` — inline per-locale objects
were dropped in favour of translation files". Measured against the installed GA pin
`@objectstack/spec@17.0.0` (`dist/ui/index.d.ts:614`), `I18nLabelSchema` is a union of
a string and a string-to-string record, and the schema's own doc block states two
authorized forms with "Both are real; neither is deprecated by this schema". Executed
against `dist/ui/index.mjs`: plain string accepted, inline locale map accepted,
`{ key, defaultValue }` rejected. A reader who believed the comment would have taken a
widening to `string | I18nLabel` for a no-op — which is what the finding recorded, one
seat having nearly done exactly that.

The replacement describes what `I18nLabel` admits and cites the spec's own doc block
rather than restating a zod expression; where today's spelling is named it is scoped as
a measurement against 17.0.0 with its file and line, so it ages as a reading rather than
as a standing fact. The decision itself is unchanged and never depended on the false
premise — `label` flows in by reference through the spec's schema, and a local
`string | I18nLabel` collapses to `I18nLabel` whichever forms the union holds.

Documentation only, and the release-visible surface is the declaration file: measured
with the package's real `tsc` build (`removeComments: false`, per `tsconfig.base.json`),
108 emitted files on both sides, `dist/ui-action.d.ts` 29,176 → 31,026 bytes, and every
other file byte-identical — including `dist/ui-action.js` (3,480 bytes, unchanged sha),
because the comment documents an `interface`, which is erased at emit along with its
leading comment. No behaviour changes; hover text and the shipped `.d.ts` do.
