---
'@object-ui/app-shell': patch
'@object-ui/core': patch
---

The object list's Import button now honours `userActions.import`'s CEL predicates.

`@objectstack/spec@17.0.0` widened BOTH toolbar-scope keys, not just `create`:
`userActions.create` and `userActions.import` are typed identically
(`z.union([z.boolean(), RowCrudActionOverrideSchema])`) and
`resolveCrudAffordances` emits a predicate envelope for each, with the docblock
binding them in one breath ("`importPredicates` — same binding as
`createPredicates`"). objectui#4646 gave the `create` half a consumer and left
the `import` half declared-and-inert: `importPredicates` had zero readers in
objectui. An author could write `userActions.import.visibleWhen`, have the spec
accept it and the resolver parse it, and watch the object-list toolbar offer the
CSV import wizard unconditionally.

The toolbar now evaluates them, mirroring the related list's create half:
`visibleWhen` fails CLOSED (an unevaluable predicate hides the entry and warns
once), `disabledWhen` fails SOFT (an unevaluable one leaves the button enabled),
and the declared-ness rules are the family's — `?? true` for `visibleWhen` so
`visibleWhen: false` hides rather than reading as "ungated", `!= null` for
`disabledWhen` so an empty predicate reads as "no condition". The layer sits on
TOP of the object-level verdict: a predicate can narrow what the `managedBy`
bucket, the server's effective API operations and the principal's grant already
allow, never re-open what they closed.

Per the spec's binding, a toolbar predicate evaluates once per toolbar against
the record of the scope the toolbar sits in — and a standalone object list has
no record in scope. Predicates over the host scope (`os.user.*`, `features.*`)
are the meaningful shape there; one reading `record.*` has nothing to bind and
hides the entry, which is the fail-closed rule the spec spells out for exactly
this surface.

`UserActionsOverride.import` widens from `boolean` to the same union as
`create`, deliberately in this same change: objectui#4646 kept it narrow on
purpose because widening a type ahead of its consumer re-declares the
inert-metadata defect one key over. Type and consumer travel together.
