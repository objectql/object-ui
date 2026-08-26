---
'@object-ui/plugin-detail': minor
---

`isConcurrentUpdateError` no longer promises a `code` its runtime check
knowingly accepts values without.

The exported predicate matches on two limbs — `code === 'CONCURRENT_UPDATE'`
(the wire shape) **or** `name === 'ConcurrentUpdateError'` (the deliberate
cross-realm discriminator, for a host that bundles the adapter twice so
`instanceof` fails). Its narrowed type declared `code: 'CONCURRENT_UPDATE'` as
a **required** literal, so for exactly the case the second limb exists to serve
the predicate handed the caller a property the value does not have. `code` is
now declared optional (`code?: 'CONCURRENT_UPDATE'`), stating only what both
limbs guarantee.

**Type-level only; zero runtime change.** The two-limb check is byte-identical
— it is deliberate and documented, and the diff touches nothing but the return
type and the comment above it. There was no runtime symptom to fix: the only
consumer (`InlineEditSaveBar`'s conflict builder) reads just the optional
`currentVersion` / `currentRecord` fields.

**Breaking for TypeScript consumers that read the narrowed `code`.** After
narrowing, `err.code` is now `'CONCURRENT_UPDATE' | undefined` instead of
`'CONCURRENT_UPDATE'`, so code that assigned it to a non-optional `string` will
newly fail to compile. That failure is the point: on a name-only error the
value was already `undefined` at runtime, and the old declaration was the
reason the compiler could not say so. Guard the read (`err.code ===
'CONCURRENT_UPDATE'` still narrows fine) or branch on the predicate itself
rather than on the field.

Pinned by `ConcurrentUpdateDialog.narrowedCode-6421.test.tsx`, which asserts
the invariant by assignability — the value the runtime accepts through the
`name` limb must be assignable to the type the predicate returns — alongside
runtime coverage of both limbs, which `plugin-detail` had none of.
