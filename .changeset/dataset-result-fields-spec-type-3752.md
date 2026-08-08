---
'@object-ui/data-objectstack': patch
---

data-objectstack: type `queryDataset`'s result `fields[]` as the spec's `AnalyticsResult.fields[]` element instead of a hand-written copy

The return-value half of the drift objectui#3613 fixed on the parameter side. The
adapter hand-listed five keys for a result column
(`name`/`type`/`label`/`format`/`currency`) and, like every restatement, stopped
at the contract of the day it was written: it never grew **`percentScale`**,
which `@objectstack/spec@17.0.0-rc.5` carries on
`AnalyticsResult.fields[]` and documents as mandatory reading for renderers —
"renderers that receive it must scale by it instead of guessing from the value"
(objectui#3136).

That omission was not cosmetic. `percentScale` is the server's answer to a
question a `%` format string cannot express (is the stored number a 0–1 fraction,
or already percentage points?), and objectui#3136 exists because guessing from
the value's magnitude printed a ratio of exactly `1` as "1.0%". Three in-repo
consumers read the field through their own local types
(`DatasetResultField` in `@object-ui/core`), so nothing was red here — but any
author reading columns through the adapter's **declared** return type got
`Property 'percentScale' does not exist`, i.e. the declaration actively steered
them back to the guess the spec bans.

`fields` is now the spec type by reference, so there is nothing left to re-sync;
the change is additive for existing consumers (one more optional key).
`queryDataset.test.ts` pins structural identity with the spec element, pins
`percentScale` as the `'fraction' | 'whole'` union rather than a widened
`string`, keeps a negative pin against the five-key shape, and adds a runtime
test that reads `percentScale` off a result column **through the declared type**.

The rest of the envelope stays locally declared, deliberately. It is the REST
envelope, not an `AnalyticsResult`: the route adds ADR-0021 D2 drill metadata
(`object` / `dimensionFields` / `drillRawRows`) on top of the spec result, and
this method rebuilds its own object from the payload without copying `sql` — so
declaring the envelope as `AnalyticsResult & { … }` would advertise a key the
adapter structurally cannot return. A pin records that too.
