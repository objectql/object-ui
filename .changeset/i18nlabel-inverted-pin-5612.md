---
'@object-ui/types': patch
---

The `I18nLabel` "inverted pin" now watches the premise it claims to watch, and
`ui-action.ts` no longer imports a symbol it never uses (objectui#5612, objectui#5613).

Both are residue of the same removed local `label` / `options[].label` override.

The `it(...)` case in `packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`
that called itself an inverted pin on the spec's `I18nLabel` rested on one assertion,
`const label: SpecI18nLabel = 'Priority'`, under a comment claiming spec 17 had narrowed
`I18nLabel` to a plain string and that a re-widening would stop it compiling. A plain
string is assignable under the narrow shape *and* under the wide one, so that assignment
could only ever fail if the plain-string form were removed — the opposite of the event it
was written to catch. The widening had already landed: `@objectstack/spec@17.0.0`
declares `I18nLabelSchema` as a union of a string and a string-to-string record
(`dist/ui/index.d.ts:614`), and the pin stayed green through it. It reported protection
it did not provide, and asserted a false premise in its own name.

It is retargeted at what actually holds the decision up — not which single form the spec
has, but that **both** authorized forms stay assignable, on the spec type and on the
inherited `ActionParam['label']` and `options[].label`. It now fails when either form is
withdrawn, and deliberately does not fail on a further widening, since inheriting by
reference is exactly what stays correct as the authorized set moves. The comment is
rewritten against the schema's own doc block (two authorized forms, "Both are real;
neither is deprecated by this schema") instead of the false premise. Verified by
construction: against a locally built narrow `type I18nLabel = string` the new assertions
fail with `TS2344` and `TS2322`, where the old assignment compiles clean under both
shapes.

`ui-action.ts`'s `I18nLabel` type import is deleted — no type position had used it since
the override was removed, and nothing re-exported it — and the doc paragraph that
recorded the pin as `NOT guarded` is corrected, since the same change makes it a guard.

No behaviour changes; the release-visible surface is the declaration file. Measured with
the package's real `tsc` build, both legs building from a cleared `dist/` and cleared
composite build info: 108 emitted files on both sides, exactly one differing —
`dist/ui-action.d.ts`, 31,026 → 31,117 bytes, JSDoc prose only, no declaration changed.
Every other file is byte-identical, including `dist/ui-action.js` (3,480 bytes, unchanged
sha), because the comment documents an `interface`, which is erased at emit along with
its leading comment. The deleted type import contributes no emitted delta at all, and the
rewritten test file is not part of the build.
