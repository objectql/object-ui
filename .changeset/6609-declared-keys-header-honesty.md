---
---

Comment-only truthfulness fix in `@object-ui/types`; no published behaviour changes, no
schema change, no test-logic change.

`packages/types/src/__tests__/form-field-zod-coverage.test.ts` introduced its pinned key
list as "Every key `FormField` (../form.ts) declares by name". The interface declares one
key the list deliberately omits — `field`, the resolved object-field metadata stash
(objectui#3090) — so the sentence overclaimed, and the pin's own rule ("any schema edit
must touch the list here in the same PR") read as an invitation to close the gap by adding
`field` to `DECLARED_KEYS` and to `FormFieldSchema`. Doing that would make
`objectui validate` accept and type a runtime-only stash on authored documents,
re-opening the spec-vocabulary pun objectui#3090 closed at the `normalizeSectionField`
chokepoint — a contract widening arriving disguised as housekeeping.

The list header now says what the list is (the AUTHORABLE key surface) and records the
exclusion as deliberate, with the reason: the stash is runtime-only, and the same key
name in the authored spec form-view vocabulary is a string naming the referenced object
field. The `FormFieldSchema` doc comment in `packages/types/src/zod/form.zod.ts` carried
the same "keys mirror the interface" overclaim and is corrected the same way
(objectui#6609).
