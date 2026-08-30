---
'@object-ui/plugin-calendar': patch
---

A standalone `object-calendar` bound to an object now queries WITH its `$expand`, so
lookup / master_detail / user / tree fields render the related record instead of a raw
foreign-key id (objectui#6453).

`ObjectCalendar`'s fetch effect built its expand set from a ref assigned in the render body
(`objectSchemaRef.current = objectSchema`) and left `objectSchema` out of its dependency
list. That bought the effect exactly one run per mount and paid for it with the expansion,
permanently: on that one run the ref was still `null`, `buildExpandFields` saw no fields,
the query went out with no `$expand` at all, and nothing re-ran the effect when the schema
landed. Only the standalone calendar reached this path — one hosted by `ObjectView` or
`ListView` receives its rows as `data`, which objectui#6419 already covers.

The ref is replaced by a settled-and-keyed resolution (`{ key, def } | null`) that GATES the
record query, the third member of the family after objectui#6271 (`ObjectKanban`) and
objectui#6419 (`ObjectView`). Measured on this component rather than inherited: gated, the
calendar issues one query carrying `$expand` in every latency profile; the alternative of
adding `objectSchema` to the dependency list issued two, and when the schema read was the
slower of the two it painted raw ids, reverted to the "Loading calendar..." placeholder,
then swapped — a three-step paint the correct rows do not arrive any later than.

The gate is on the schema read having SETTLED, never on a truthy schema: an adapter that
exposes no `getObjectSchema`, and a read that throws, both settle with nothing and the
calendar still queries (unexpanded) rather than waiting forever. An inline `value` data set
is deliberately not gated — it issues no metadata read, so there would be no resolution to
wait for.
