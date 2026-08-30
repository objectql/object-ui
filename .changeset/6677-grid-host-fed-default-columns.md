---
'@object-ui/plugin-grid': patch
---

An object-bound grid whose rows arrive from a **host** now renders the object
schema's default-columns policy instead of the row payload's keys
(objectui#6677).

`ObjectGrid.generateColumns()` checks three default paths in order: authored
`columns` → the inline-data path → the object-schema path. The inline-data path
is gated on `hasInlineData` (`dataConfig.provider === 'value'`), and
`dataConfig` is built as `provider: 'value'` from the `data` **prop** before
anything else — so it is taken by every grid whose rows were handed down rather
than fetched. It returned unconditionally whenever rows were present, and its
projection is `schemaFields || Object.keys(inlineData[0])`, the first row's
keys. That made the object-schema path — the one carrying the documented policy
(`highlightFields` first; else drop `hidden`, drop readonly system-managed, push
the remaining system/ownership columns to the end) — **unreachable for every
object-bound grid reached through a fetching host** (`ListView`, `ObjectView`,
…). The branch that knows the object was the one that never ran.

Measured on the same page, source and object with one variable — who fetches:
`<object-grid objectName="opportunity" />` rendered the policy's **5** columns
(Opportunity Name / Stage / Amount / Close Date / Owner); the same object behind
`<list-view>` rendered **10**, adding `Id` (`hidden: true`) and the four audit
columns (`system`). Those are exactly what the policy exists to keep off a
default list, and the extra key set was whatever the query happened to return.

**The yield is as narrow as the defect, and the two boundaries are the change.**
Only the row-key *fallback* is wrong for an object-bound grid, so only that is
given up, and only once there is a policy to give it up to
(`!schemaFields && !!objectName && !!objectSchema`):

- **An authored `fields` projection still wins.** The schema path drops a name
  the object does not declare (`if (!field) return;`), and a host may
  legitimately join or derive keys, so an explicit projection is not overridden
  — including when it names an audit column on purpose. `!schemaFields` is
  exactly the condition under which the `||` reaches for the row keys, so the
  gate cannot drift from the fallback it guards.
- **Gating on `objectName` alone would have been a worse defect.** The schema
  arrives from an async fetch, so `objectSchema` is `null` on first paint; that
  gate falls through to `if (!objectSchema) return []` and paints an empty
  header row before flipping. Requiring the *loaded* schema keeps the row-key
  columns on screen until the object is actually known, and is also the
  graceful fallback when the schema fetch fails or the data source has no
  `getObjectSchema` — the grid degrades to heuristic columns rather than going
  blank.

Inline data with no object behind it is untouched: the "Legacy support" path is
reordered, never deleted, and is still the right answer there.

Scored **patch**, deliberately. No public API moves — no prop, type, export or
signature changes — and this restores the default-columns policy the component
already documents and already applied whenever the grid fetched its own rows;
the host-fed divergence was the defect, not a contract. `minor` was considered,
because the visible column set changes on existing screens, and rejected: the
lost columns were never *declared* by any author, only leaked by the branch
order, and this repo scores behaviour-correcting fixes as patch and reserves
`minor` for new capability (a `major` is never authored here — the fixed group
tracks `@objectstack`).
