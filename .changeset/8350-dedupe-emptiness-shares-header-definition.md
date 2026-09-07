---
'@object-ui/plugin-detail': minor
'@object-ui/core': minor
---

`record:details`' dedupe and the page H1 now share ONE definition of "this record
has a value here" (objectui#8350).

The renderer drops from the body grid the one field whose value the page H1 is
already showing. objectui#8175 (PR #8349) made the two halves agree on **which
field** — the ladder leads with the unified ADR-0079 resolver. They still
disagreed on **what counts as a value**.

**The user-visible defect.** The header half decides emptiness through
`@object-ui/core`'s `recordDisplayValueAt`, which **trims**: a whitespace-only
value is empty, so `getRecordDisplayName` walks on to the next rung. The ladder
asked its own raw `undefined` / `null` / `''` question, which a whitespace-only
value passes. So for a record whose title field held only spaces:

- the H1 walked past that field and showed something else — say `Acme
  Corporation`, resolved one rung further down;
- the grid hid the blank field's row anyway, concluding it was the duplicate;
- and the row that really did repeat the heading, `Acme Corporation`, stayed.

A field disappeared from the grid to deduplicate against a heading that never
displayed it. The failure is silent: nothing errors, a row is simply absent.

**The change.** The ladder now calls `recordDisplayValueAt` — the very function
every value-keyed rung of `getRecordDisplayName` uses — instead of re-spelling
the test. `@object-ui/core` exports it for that purpose; it was the module-private
`valueAt`, unchanged in behaviour and renamed only to be a defensible public
name. One authority, not two implementations that agree today.

**Behaviour change, deliberately — this is wider than trimming.** Sharing the
definition also imports the two other things it decides, and both bring the grid
into line with the heading:

- an expanded/embedded reference object is **empty** when its Salesforce-style
  display chain yields nothing, so a bare `{ id: 'u1' }` lookup payload no longer
  claims the dedupe (the raw test read any object as a value — and so would a
  bolted-on `.trim()`, which is why the fix is delegation rather than a trim);
- non-strings are stringified, so `0` and `false` remain values, not blanks.

In every case the new answer is the one the H1 was already giving.

**New export.** `@object-ui/core` gains `recordDisplayValueAt(record, field)`.
Additive: nothing imported the private `valueAt`, and `getRecordDisplayName`'s
own answers are unchanged.
