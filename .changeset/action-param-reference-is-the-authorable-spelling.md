---
"@object-ui/types": minor
"@object-ui/app-shell": minor
---

`reference` is the one authorable action-param picker target (objectui#3174).

**Breaking for authoring**: `ActionParam` in `@object-ui/types` no longer
declares the nine resolved-side picker keys — `referenceTo`, `displayField`,
`idField`, `descriptionField`, `titleFormat`, `lookupColumns`, `lookupFilters`,
`lookupPageSize`, `dependsOn`. FROM: `{ name: 'account_id', type: 'lookup',
referenceTo: 'account' }` type-checked. TO: `{ name: 'account_id', type:
'lookup', reference: 'account' }` — or make the param field-backed
(`{ field: 'account_id' }`) and it inherits the whole picker group from the
object field.

The two halves of one contract disagreed about a spelling, and the type was the
half that was wrong. `resolveActionParams()` reads the spec's `reference` for an
inline `lookup`/`master_detail` target and nothing else; it EMITS
`ActionParamDef.referenceTo`, the resolved spelling. The public authoring type
declared the resolved spelling "for parity with the resolved shape", so an
author who followed it got a param whose picker target was dropped in the
resolver and a dialog that degraded to a plain record-id text input — asking a
human to paste a UUID. The dev warning that fired then told them to declare
`reference`, a key the type did not have.

`reference` wins because the platform had already decided: `ActionParamSchema` in
`@objectstack/spec` is `.strict()`, lists `referenceTo` **by name** in its
alias map, and answers it with "use `reference`". So an authored `referenceTo`
was never storable — it was a hard parse rejection on the server while `tsc`
waved it through. Resolving it in objectui instead would have made the renderer
accept metadata the platform itself refuses, and such a param would work in a
locally-authored TS action and fail at publish; removing the declaration moves
the failure to where it can be fixed, at the authoring keystroke.

- **`@object-ui/types`**: the nine keys are gone, and the rule they violated is
  now pinned — `ActionParam` declares *exactly* the spec's authorable key set.
  The drift guard names the single exception (`validation`, inert and rejected
  by the same `.strict()` parse — filed as objectui#3201) so a second one cannot
  appear without being a decision.
- **`@object-ui/app-shell`**: `resolveActionParams()` names any resolved-only
  key it finds on an authored param in a dev-mode warning, with the
  prescription (`referenceTo` → "use `reference`"; the rest → "make the param
  field-backed"). It still does **not** read them. This covers the gap `tsc`
  cannot gate — params authored in plain JS, loaded from JSON, or synthesised
  at runtime — so the mistake is loud where it is made rather than surfacing
  downstream as `paramToField()`'s "no reference target" warning naming a key
  the author never wrote.

The internal pipeline keeps its two spellings on purpose (authoring `reference`
→ `ActionParamDef.referenceTo` → the field's `reference_to`); what is pinned now
is that the public entry and the public exit agree. The end-to-end test authors
through the published `ActionParam` and follows one param to `reference_to` —
every previous test authored the resolver's own local input interface, which is
why the resolver only ever agreed with itself and the mismatch survived.
