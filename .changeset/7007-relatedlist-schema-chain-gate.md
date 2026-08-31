---
---

Test-only: `RelatedList.unmaterializedSort.test.tsx` now gates the `getObjectSchema` chain
as well as the fetch chain. No published behaviour changes; no runtime code was touched.

Both `#3950` refusal blocks settled only the FETCH chain — `columnSortable('name')` for the
column headers, `h.schema?.type === 'data-list'` for the sort-button row — and then read a
value that arrives on a DIFFERENT chain: `withheldFromServerSort` derives its verdict from
`objectSchema.fields[field]`, fetched by the effect at `RelatedList.tsx:430`. With no schema
in state yet the predicate falls through to `isUnmaterializedFieldType(undefined)`, which is
`false` — "offer the sort" — so `Total` is still sortable and still has a button. The blocks
were green only because that effect is declared before the fetch effect and both mocks
resolve on the same microtask; nothing pinned that ordering, and a flaky RED in the merge
queue ejects unrelated pull requests.

Measured rather than assumed: with the timing FACT mutated and nothing else — the mock
schema resolving after a 50ms delay instead of on the first microtask — the old spelling
fails at `:123` (`expected true to be false`) and at `:153` (`expected <button>Total</button>
to be null`), with the stored-column controls present in both blocks, reproducing the race.
The new spelling passes under the same delay.

Each block KEEPS its existing gate and ADDS the second one (the objectui#6959 precedent and
its trap): the first gate proves the view committed with rows at all, which is what keeps
`queryBy…).toBeNull()` from passing vacuously; the second proves the schema the verdict is
derived from has landed. Trading one for the other would have left the block blind on
whichever side it dropped.

The gate is not `expect(getObjectSchema).toHaveBeenCalled()` — a mock CALL is issued one
resolution before its value reaches state, which is the trap #6959 recorded. It awaits the
promise the component itself awaited and flushes the commit through `act`.
