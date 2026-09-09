---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

`listViews` no longer renders a refused metadata read as "this object has no saved views"
(objectui#8151).

`ObjectStackAdapter.listViews` degrades every failure to an empty list, and every consumer
reads only the return. So "the server served zero saved views" and "the server refused, or
broke" produced the identical UI — with a `console.warn` as the only discriminator, in the
browser console, with nothing pointing at it. It is the same defect objectui#7741 removed
from `listImportMappings` one method over, and the user-visible cost is the higher one: an
empty `listViews` is an object's **view switcher**, so a user whose token lapsed
mid-session could be shown an object that appears to have no saved views at all —
including views they created themselves.

**The empty-list return is unchanged.** `listViews` still answers `Promise<any[]>` and
still never throws, on every arm including the loud ones — this is a channel added
ALONGSIDE that contract, not a change to it. `listImportMappings` is likewise unchanged,
down to its wording.

- **`ObjectStackAdapter.listViews` now emits on `onMetadataReadWarning`** — the channel
  objectui#7741 added — when the read failed in a way that is not the supported "this host
  mounted no metadata door" shape. The event carries the object, whether the server
  `refused` this caller or the answer was `unreadable`, and the server's own ADR-0112
  code, HTTP status and message.
- **New: `classifyViewsFailure(err)`.** A SEPARATE reading, deliberately not a second
  caller of `classifyImportMappingsFailure`: `view`'s quiet set is strictly smaller. The
  arm the mapping classifier is built around — 400 `INVALID_REQUEST`, the metadata list
  door's "this deployment carries no such kind" — is unreachable for `view`, which is in
  the platform's static spelling contract, so reading it as kind-absence would swallow a
  real refusal. On `view`, only a host with no `/meta` door at all stays quiet.
- **`MetadataReadWarningEvent`'s `operation` and `kind` gain their second members**
  (`'listViews'` / `'view'`). This is the additive, reviewed widening the single-member
  unions were designed for, and it worked as designed: the consumer that renders these
  events had a `switch` naming one operation, so the widening turned "a views failure is
  toasted as an import-mapping failure" into a compile error rather than a runtime lie.
- **New: `MetadataReadFailureKind`**, the neutral spelling of the three verdicts.
  `ImportMappingsFailureKind` is now an alias of it — identical members, so existing
  consumers are unaffected in both directions.
- **The console says which list it was.** `metadataReadWarningToast` picks its title and
  its remedy by `operation`, so a failed view read reads *"Saved views for {{object}}
  could not be loaded … not because this object has no saved views"*. Three new
  `console.savedViews*` keys ship in all ten locale packs; the `console.importMappings*`
  copy is untouched.

This applies framework #13906 decision 1 option A — *a thing that could not be READ is not
a thing that is ABSENT* — at the second seam that needed it.
