---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

`listImportMappings` no longer renders a refused door as "no mapping is registered"
(objectui#7741).

`ObjectStackAdapter.listImportMappings` degrades every failure to an empty list, and the
import wizard hides its saved-mapping selector on an empty list. So "the server served
zero mappings" and "the server refused, or broke" produced the identical UI on every
deployment — the feature simply absent — with a `console.warn` as the only
discriminator, in the browser console, with nothing pointing at it. That silence did not
merely hide a fault: it produced a confident WRONG diagnosis in a careful reporter
(objectstack#14026 was filed, routed and worked by two seats against a wizard that had
been correct since `@object-ui/data-objectstack@17.1.0`).

**The empty-list return is unchanged.** `listImportMappings` still answers
`Promise<any[]>` and still never throws, on every arm including the loud ones — this is
a channel added ALONGSIDE that contract, not a change to it.

- **New: `ObjectStackAdapter.onMetadataReadWarning(cb)`** — a subscribe/unsubscribe
  channel, sibling in shape to `onWriteWarning` and `onSaveAdvisory`. It fires when a
  metadata read failed in a way that is NOT the supported "this deployment does not
  serve that kind" shape, carrying `MetadataReadWarningEvent`: which read it was, the
  object, whether the server `refused` this caller or the answer was `unreadable`, and
  the server's own ADR-0112 code, HTTP status and message.
- **New: `classifyImportMappingsFailure(err)`** and `ImportMappingsFailureKind`, exported
  so a consumer can apply the same verdict. It reads the ERROR — the ADR-0112 `code`
  first, the status only where no code was declared — and never "is the result an empty
  array", which is what both conditions produce and so can never tell them apart.
- **The older-server case stays quiet.** A deployment that does not serve the `mapping`
  kind (404/501 with no route, `ROUTE_NOT_FOUND`, `NOT_IMPLEMENTED`, or the metadata list
  door's 400 `INVALID_REQUEST`) still degrades to an empty list with no selector and no
  event. That is a real, supported deployment shape and it must not become a visible
  fault.
- **The console now says so.** `AdapterProvider` subscribes to the new channel and
  renders a warning toast naming the object, the remedy and the server's own words, so a
  user without devtools open can tell "there are none" from "we could not find out".
  Three new `console.importMappings*` keys ship in all ten locale packs.

This applies framework #13906 decision 1 option A — *a thing that could not be READ is
not a thing that is ABSENT* — at this seam. It is an already-adopted discrimination, not
a new principle.
