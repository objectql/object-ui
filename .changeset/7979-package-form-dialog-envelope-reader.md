---
'@object-ui/app-shell': patch
---

`PackageFormDialog` reads the producer-marked `error.userMessage` (objectui#7979).

The create / edit / view package dialog POSTs and PATCHes `/api/v1/packages` through its
own `apiJson`, which held a fourth copy of the ADR-0112 failure-envelope ladder —
character for character the one `PackagesPage` had before objectui#7959. It read the
diagnostic `error.message` and stopped, so two things a refusal carries never reached the
author: the producer's marked `error.userMessage` (present since objectstack#9934, emitted
by both doors that serve these routes) and `error.code`.

The read now comes from the one shared rule, `readEnvelopeFailureText`
(`utils/apiErrorEnvelope.ts`), which prefers the mark over the diagnostic and appends the
declared code behind whichever prose won. Create and edit are exactly where an author meets
a refusal that names what to fix — a namespace rule, a version already published — and in
the 5xx band the door substitutes the generic `Internal server error` into `message` while
the mark rides through untouched, so on a marked 500/503 the dialog used to show the generic
sentence and discard the specific one.

The two rungs below the shared read stay: a bare-string `error` and a top-level `message`
are older runtimes' shapes, not this envelope, and they are live for this call site alone.
The dialog's two status-driven arms (409 → "already exists", 403 → the localized capability
copy, objectstack#8270) are unchanged.
