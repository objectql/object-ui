---
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-view': minor
---

Seven more `find()` readers now read exactly what `QueryResult` declares — the
`records` arm is removed from each (objectui#6726, following objectui#5945).

`QueryResult` (`@object-ui/types`) declares exactly one rows member — `data` —
alongside `total`, `page`, `pageSize`, `hasMore`, `cursor` and `metadata`.
`records` is not a member of it. It is the spelling the server envelope and the
client SDK use, which `ObjectStackAdapter.normalizeQueryResult` maps to `data`
before returning — a *below*-the-adapter spelling that had leaked into
above-the-adapter consumers. objectui#5945 removed it from two app-shell
readers; these are the seven the same producer sweep turned up and that card did
not name:

| module | what it does |
| --- | --- |
| `components/src/hooks/related-count-store.ts` | related-list tab badge count |
| `components/src/renderers/basic/data-list.tsx` | `element:repeater` rows |
| `components/src/renderers/basic/elements.tsx` | `element:number` client-side aggregate |
| `components/src/renderers/basic/record-picker.tsx` | `element:record_picker` options |
| `plugin-detail/src/renderers/record-activity.tsx` | `record:activity` self-fetch |
| `plugin-detail/src/renderers/record-history.tsx` | `record:history` self-fetch |
| `plugin-view/src/ObjectView.tsx` | non-grid (kanban / calendar / gallery / timeline) fetch |

**One of them was actively wrong, six were dead.** `related-count-store.ts`
read `records` *ahead of* `data` — the precedence inversion objectui#5945 was
filed about — so a `find()` answer carrying both would have been counted from
the key the contract does not declare. The other six read `data` first, so their
`records` arm could never be reached by a conforming producer. A dead tolerant
arm is not harmless: it is where a non-conforming producer keeps working
unrejected, and hardens into a second de-facto contract nobody is checking
(AGENTS.md #0.1).

**What stops being accepted.** A `find()` answer shaped `{ records: [...] }`
now reads as **no rows** at these seams instead of silently resolving. Every
call site degrades rather than throws: the tab badge counts 0, the repeater and
the picker render their empty state, `element:number` reports 0, the activity
and history feeds render empty, and the non-grid views paint no rows.

**Nothing produces that shape at this seam today**, which is why this is a
removal rather than a migration. Measured repo-wide over every tracked file:
`ObjectStackAdapter.normalizeQueryResult` CONSUMES the server/SDK `records`
envelope and returns `{ data, total, page, pageSize, hasMore }`; every other
`find()` implementation in the repo (`ApiDataSource`, `ValueDataSource`, the
runner and example mocks, the `@object-ui/types` REST example) returns `data`
or a bare array. The `records` producers that DO exist are on other seams and
are untouched: `ViewDataProvider`'s own `ResolvedData` interface, which declares
`records` legitimately; the raw Cloud HTTP payloads `marketplaceApi.ts` and
`packagedActions.ts` read; and the client-SDK doubles that sit *below*
`normalizeQueryResult`.

**The bare-array arm is kept** wherever it existed, because it is live: fakes at
these seams answer with a plain array. Each module carries its own pin —
`*.contractEnvelope-6726.*` — asserting the contract read, the live arms, and
the refusal of `records`, so the live and the dead shapes cannot drift into each
other.

`QueryResult` is **not** widened to bless `records`; that would be a
published-type change and a maintainer decision.
