---
'@object-ui/types': patch
---

`exportOptions`: the alignment claim is now checked against the installed spec,
not asserted in prose

`ListViewExportOptions` mirrors `@objectstack/spec`'s
`ListViewSchema.exportOptions` object branch. The comment above it explained
that the five keys were restated rather than derived "because objectui still
pins `@objectstack/spec@17.0.0-rc.6`, whose `ListView.exportOptions` is the
LEGACY bare format array".

That is no longer true. objectui installs `@objectstack/spec@17.2.0`, which
carries the object form: the bare format array lifts to `{ formats: [...] }` at
parse and `'pdf'` has left the enum. Nobody edited the comment; the dependency
moved underneath it. This is the second time this particular comment has gone
false — objectui#4535 was filed for the first — and both times the mechanism was
the same: a prose claim about another package's shape, with nothing that fails
when that shape changes.

So the reason is corrected and, more to the point, it stops being load-bearing.
A new `export-options-spec-parity.test.ts` reads the object branch out of the
spec package that is actually installed, at test time, and asserts against it:
the key set, the format enum (`'pdf'` absent from both sides), upstream
strictness, the migration prescription the `'pdf'` refusal carries, and the
parse-time array lift. The key set is projected from `keyof
ListViewExportOptions` through an exhaustive `Record`, so a local key added or
dropped fails to compile rather than passing a comparison against a hand-copied
list.

The mirror itself is unchanged, and stays a mirror for a measured reason the
test now pins: `ListViewExportOptionsSchema` is internal to the spec bundle and
is not one of the package's public exports, so there is nothing to import. Only
the enclosing `ListViewSchema` is exported, and its `exportOptions` is a
two-branch union whose inferred type is not this interface. When upstream
exports the symbol, the test says so by failing, and the mirror can go.

Types are unchanged — no export added or removed, no key or union altered — so
this is a patch. The shape change was the earlier minor that introduced
`ListViewExportOptions`.
