---
---

Test-only: `ObjectGantt.referenceArms-6837.test.tsx` now reads the chart through an
asynchronous query instead of racing it. No published behaviour changes; no runtime code
was touched.

The block at `:257` mounted through the file's `mount()` helper, whose gate settles a MOCK
CALL — `find('task', { $expand })` was ISSUED — and then read the DOM synchronously with
`getByTestId('gantt-view')`. Those are two different facts one promise-resolution apart:
`ObjectGantt` flips `loading` false in the `finally` of `reload()`, i.e. after that find
RESOLVES, so on return from `mount()` the component can still be painting its
`Loading Gantt chart...` branch. The synchronous read raced it and lost twice in fifteen
minutes in the merge queue — a heavier environment than PR CI — ejecting two pull requests
that do not touch `plugin-gantt` at all, one of which passed and failed the queue on
byte-identical content.

The assertion is unchanged, and `mount()` keeps its find-call gate: the refusal probe above
this block needs proof of the SCHEMA-dependent commit, which the chart's presence alone does
not carry (`loading` flips false after the FIRST find resolves, before `objectSchema`
lands). The two gates measure different facts, so the block now waits for both rather than
trading one for the other.

Measured rather than assumed: with the data source's resolution delayed 500ms — the timing
FACT mutated, never the assertion — the old spelling throws
`Unable to find an element by: [data-testid="gantt-view"]` against a DOM reading exactly
`Loading Gantt chart...`, reproducing the queue failure, while the new spelling resolves
through that fallback and reads `data-count=2`.
