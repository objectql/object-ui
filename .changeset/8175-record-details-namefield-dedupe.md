---
'@object-ui/plugin-detail': minor
---

`record:details`' dedupe now asks the unified ADR-0079 resolver which row to hide
(objectui#8175).

The renderer drops from the body grid the one field whose value the page H1 is
already showing, so a record page does not print `Contract No: HT-2026-001`
directly under an H1 reading `HT-2026-001`. It picked that field with a six-entry
literal walk — `name`, `full_name`, `title`, `subject`, `display_name`, `label` —
which is the **tail** of the chain `PageHeaderRenderer` uses to draw the H1 a
package away, with no equivalent of the ADR-0079 resolver rung that sits above it
in that chain.

**The user-visible defect.** For an object whose declared `nameField` names a
field the literal walk does not know, *both halves of the dedupe were wrong at
once*. On an object declaring `nameField: 'contract_no'`, for a record carrying
both `contract_no` and an ordinary `name`:

- the H1 showed `contract_no`'s value (correct — that half was already right);
- the grid still showed the `contract_no` row, repeating the heading;
- and the grid dropped the `name` row, a field the heading never showed.

**The change.** The candidate list now leads with `resolveNameField` and
`deriveTitleField` from `@object-ui/core` — the same ADR-0079 resolver
`getRecordDisplayName` reads to produce the H1's *value*, and the one
`resolveTitleField` in this package already delegates to. The literal walk stays
as the tail, unchanged, for records whose object definition resolves nothing.

**Breaking, deliberately — a different row can now be hidden.** This is a
behaviour change for any object the resolver answers for and the literal walk did
not, which includes objects with no name-ish field at all: there the resolver's
type-aware derivation lands on the first title-eligible field by declaration
order, and that field *is* what the page H1 shows, so the grid stops repeating it.
Authors who want a field back can keep it out of the dedupe the way they always
could — the ladder only ever hides a field whose value is non-empty on the record.

The rung is spelled as **two** candidates rather than one `resolveNameField` call.
That call returns a single answer and short-circuits: a declared pointer wins
outright and the derivation never runs. This ladder is value-keyed, and so is the
header's own chain — when the declared pointer is blank on a record,
`getRecordDisplayName` keeps walking and lands on the derivation. Listing both
rungs is what lets the same fall-through happen here.

Two rungs of the header chain are deliberately **not** mirrored, because neither
names a field and so neither has a row to hide: `page:header`'s own `schema.title`
(which this package cannot see) and `objectSchema.titleFormat` (a render-only
template the header ranks above the declared pointer).
