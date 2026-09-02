---
'@object-ui/app-shell': minor
---

Studio workbench rails converge on an AI copilot apply without a page reload (objectui#7255)

The copilot is the right dock of the Studio document and already announces
every authoring turn on the assistant bus (`emitMetadataRefresh`), but the
four pillar rails never subscribed: a just-applied object or nav item stayed
invisible until the author reloaded the page. The Interfaces / Data /
Automations / Access rails now list that pulse as a load dependency and refetch
their package-scoped reads in place. The Interfaces rail holds the pulse while
the nav editor has unsaved edits (its load rehydrates the nav edit buffer) and
releases it once they settle, and re-reading the same package no longer flaps
the app status back through `loading`.
