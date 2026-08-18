---
'@object-ui/app-shell': patch
---

The object-list page's "New" button and its phone floating "+" now consume `userActions.create` predicates.

`createPredicates` had exactly one consumer in objectui: the related-list toolbar
(objectui#4646). The standalone object-list page renders the same create
affordance twice — a PageHeader button and the phone-only floating "+" that
stands in for it once the header is hidden — and neither read the key. Both
gated on the object-level verdict alone (`affordances.create` plus the
principal's `create` grant), so one `userActions.create` object form produced two
different answers depending on which surface drew the button: honoured on a
record page's related list, ignored on the object list. `visibleWhen: false` —
the objectui#3492 shape — did not hide this "New".

Both entry points now layer the toolbar-scope predicates on top of that verdict,
mirroring the `import` half landed in the same file (objectui#5142):
`visibleWhen` fails CLOSED and counts as declared by `?? true` (so
`visibleWhen: false` hides rather than reading as "ungated"), `disabledWhen`
fails SOFT with its `!= null` declared-ness gate outside the evaluation (so
`disabledWhen: ''` is "no condition", not "disable"). Hidden and greyed stay
distinct at both points; the phone "+" takes the native `disabled` plus the same
`disabled:` utilities the design system's `Button` carries, rather than
collapsing the greyed state onto "hidden".

The binding is the spec's, unchanged: a toolbar predicate evaluates once per
toolbar against the record of the scope the toolbar sits in, and a standalone
object list has no record in scope — so predicates over `os.user.*` / `features.*`
bind normally and are the meaningful shape here, while one reading `record.*` has
nothing to bind and fails closed. A predicate can only narrow: it never re-opens
what the `managedBy` bucket, the object's effective API operations or the
principal's grant have already closed.
