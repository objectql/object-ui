---
'@object-ui/plugin-grid': patch
'@object-ui/plugin-list': patch
---

FLS-gate the `$expand` projection at both build sites (objectui#7215).

objectui#6898 closed field-level security on `$select`. `$expand` was left ungated at
both projection sites — `ObjectGrid`'s own fetch and `ListView`'s `expandFields` memo —
so a `lookup` / `master_detail` / `user` / `tree` field the current principal cannot
read was still handed to the server for expansion. `$select` on a denied lookup asks for
its bare foreign key; `$expand` on the same field asks the server to resolve it and
return the related record, so the larger of the two disclosures was the ungated one.

**Reproduced before it was fixed**, as failing tests at both sites, and the same leak
reaches further on the `ListView` path: that builder's `$select` gate drops the denied
column and then adds the expand roots back unconditionally, so the denied field walked
back into `$select` as well. Gating the expansion closes both halves.

**Grading, measured rather than assumed.** Against ObjectStack's own server this is
defence-in-depth, exactly as objectui#6898 is: `plugin-security`'s
`FieldMasker.maskRecord` deletes every unreadable key from each returned row, and
objectql's expand path writes the resolved record back under that same key, so one
statement removes the expanded object and the bare id alike; the expansion sub-read is
itself gated (`__expandRead` takes the referenced object's full CRUD + RLS + FLS
treatment). It is load-bearing for any backend that does not strip.

**Nothing a permitted view did stops working.** The gate judges the OUTPUT of
`buildExpandFields`, which is already a subset of the object's declared
reference-bearing fields, so the "`checkField` answers false for an undeclared key"
trap cannot be reached and derived / host-joined columns are untouched. An unanswered
permission policy filters nothing. `buildExpandFields` itself is unchanged.
