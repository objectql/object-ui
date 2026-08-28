---
'@object-ui/data-objectstack': minor
---

`MetadataClient.layered()` validates the ADR-0010 protection envelope against the
producer's own schema at the boundary, instead of casting ten wire fields through
unchecked (objectui#5676, triage adjudication 2026-08-22).

The envelope arrived by ten `as` assertions over a raw `res.json()` body — no parse, no
allowlist, no default. The consumer that reads it opens the metadata lock banner on
`layered?.lock && layered.lock !== 'none'`, true for **any** non-`none` value, so a server
sending a lock state this console had never heard of opened the amber box, drew the padlock
and the border, and rendered an empty title. No fifth state ever had to be added to this
repo for that to happen: a union types what this repo writes and constrains nothing about
what a server sends.

The boundary now runs `GetMetaItemLayeredResponseSchema.safeParse`. On the conforming path
every value is the producer's schema output and the ten assertions are gone. `safeParse`
and never `parse`: a metadata console that rejected every dialect it had not been compiled
against would answer a newer server with a blank page, which is strictly worse than the
wrong render being fixed. Values the schema rejects are still **forwarded** — dropping them
would be that same refused rejection wearing different clothes — and are named in a new
optional `MetadataLayered._unrecognized`, absent whenever everything parsed. This extends
to the whole envelope the "pass through and label" treatment objectui#5672 chose for `lock`
alone; the banner's existing unrecognised-token title is unchanged and needed no edit.

The labelling is per field, which is the part that makes it a degrade rather than a subtler
version of the same bug. Measured on the installed spec (17.2.0):
`GetMetaItemLayeredResponseSchema.safeParse(body)` is all-or-nothing — one unknown `lock`
returns `success: false` with `data` undefined — so the failure branch re-checks each key
against that schema's own `shape[key]`, where only the offending field fails and the other
six still arrive typed. Absence is never "unrecognised": the four resolved verdicts are
required upstream on this path, so a pre-ADR-0010 backend takes the failure branch with
nothing flagged and behaves exactly as before.

One consequence of the same ruling, fixed alongside because it defeats it: a 200 answer
whose body was a bare JSON string or number **rejected** the promise with a
`TypeError: Cannot use 'in' operator`, from the envelope-detection guard's bare truthiness
check. A malformed body must degrade, never throw.
