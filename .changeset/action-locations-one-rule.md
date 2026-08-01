---
"@object-ui/types": minor
"@object-ui/components": minor
"@object-ui/app-shell": minor
---

One placement rule for action `locations` (objectui#3142).

**Breaking for metadata**: an action that declares no `locations` (missing key
or `[]`) no longer renders in a located surface. FROM: omitting `locations`
made an action appear on the list toolbar, the record header, and every
metadata-admin toolbar. TO: declare where it belongs —
`locations: ['record_header']` for the record header, `['list_toolbar']` for
the list toolbar, and so on. Nothing else changes; actions that already
declare a location are untouched.

Four renderers each answered "where does an action with no `locations` go?"
differently — `action:bar` and metadata-admin showed it EVERYWHERE,
`page:header` showed it on the header, `action:group` showed it for
`undefined` but hid it for `[]` — while `ActionEngine`, `RecordDetailView`,
`DeclaredActionsBar`, the related-list bridge and the environment toolbar all
showed it NOWHERE. The same action therefore appeared or vanished depending on
which component happened to draw it. All eight now go through one exported
predicate, `actionRendersAt(action, location)` from `@object-ui/types`: an
action renders at a location only if it declares that location.

The strict reading is the platform's own — ADR-0078 lists "an `action` with no
`locations`" as a verified inert shape, and the detail-page synthesizer already
documented "must include `locations: ['record_header']` to render". The
leniency contradicted both, and it is what let an aggregate-only bulk action
(objectui#3139) — one with no single-record placement by construction — mint a
list-toolbar button whose dispatch could only fail.

Two placements are declared elsewhere and need no `locations`, both unchanged:
host-injected chrome in the `systemActions` / `headerSystemActions` slot (now
consistently exempt on `page:header` too, where it used to be filtered), and an
action named in a view's `bulkActions` / `bulkActionDefs`.

Authoring side: Studio seeds `locations: ['record_header']` on a new action
instead of minting one that renders nowhere, and the action inspector says so
when no placement is ticked. The `ActionSchema.locations` JSDoc claimed a
`['record_header']` default that no renderer ever implemented — corrected.
