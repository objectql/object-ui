---
"@object-ui/app-shell": patch
---

The Studio RLS editor no longer authors the retired `rowLevelSecurity[].priority` key (objectstack#7130)

`rowLevelSecurity[].priority` was removed in `@objectstack/spec` 17.0.0
(objectstack#3896) and left as a `retiredKey` tombstone in
`packages/spec/src/security/rls.zod.ts` — an authored value is REJECTED at parse
time with the upgrade prescription, not ignored. It promised "conflict
resolution" that cannot exist: applicable policies OR-combine (most permissive
wins), so there is no conflict to order.

`PermissionAdvancedFacets` — the structured RLS editor on the Studio permission
matrix — was still typing the key and seeding `priority: 0` on every policy its
"Add policy" button created. Its docblock described the shapes as mirroring the
framework spec, but that mirror was sampled before the removal. Nothing on the
save path removed the key: `doSave` sends the draft verbatim, and at package
scope `mergePermissionSlice` copies `rowLevelSecurity` from the freshly-read
base while taking only `objects`/`fields` from the edit — so at environment
scope (the only scope where these facets are persisted) the seeded key went
straight into the saved permission set. A user who added an RLS policy through
the editor therefore wrote a permission set the parser refuses.

Three changes, all editor-side:

- the local `RlsPolicy` shape drops `priority`;
- the Add-policy seed drops `priority: 0` — it now authors exactly
  `{name,object,operation,using,enabled}`;
- policies are stripped of the retired key as they are read out of the draft, so
  a permission set already carrying `priority` (written by this editor before
  this fix) comes out clean the moment any RLS edit re-emits the list. This is
  editor hygiene, not a data migration: a set nobody opens is untouched, and the
  strip is keyed to the named tombstone rather than being a blanket unknown-key
  purge, so every live key the editor does not itself render survives a
  round-trip.

The docblock stops claiming the shapes are "sampled from live data" — that
sampling is exactly how a removed key stayed in the editor for ten days.
