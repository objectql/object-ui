---
'@object-ui/app-shell': patch
---

Every envelope reader on the package surfaces now renders a producer-marked
`error.userMessage`, and the Studio package list opens the failure body at all.

`fetchPackages` — the `/api/v1/packages` read behind the Studio switcher, the writability
courtesy gate, the namespace lookup and the builder landing page — answered a refusal with
`HTTP <status>` and never opened the body, so `message`, `code` and `userMessage` were
discarded together: a 403 whose envelope said `Reading packages requires the studio.access
or setup.access capability.` reached the author as four characters. `apiJson` on the
package admin page read `error.message` and never the mark, and rendered no code.
`duplicatePackage` read `error.message` alone.

All three now ask one shared rule (`readEnvelopeFailureText`): a producer-marked
`userMessage` outranks the diagnostic `message` at any status — presence of the field is
the producer's marking, and a consumer that sees it renders it verbatim — with `error.code`
appended to whichever prose won. An unmarked refusal is unchanged and still renders its
diagnostic; a body carrying no prose still falls back to each reader's own status text.
