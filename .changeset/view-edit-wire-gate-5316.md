---
'@object-ui/app-shell': patch
---

metadata-admin no longer false-rejects a stored `view` that has been pinned or
reordered. The editor's live client-side validation judged BOTH the create and
the edit draft with the AUTHORING schema (`ViewItemSchema` via
`viewSchemaForDraft`). That is right for create and wrong for edit: the editor
opens a body that came back out of `sys_metadata`, and the platform itself
writes keys into stored view bodies — `isPinned` from the view switcher's pin
action, `sortOrder` from the reorder write, and a per-row `id` that the console
filter/sort builders stamp on `config.filter[]` for React. `updateView` GETs the
stored item and PUTs `{ ...current, ...partial }`, and `saveMetaItem` persists
the accepted body verbatim, so those keys are in storage by design.

Before the authoring schemas were tightened these keys were silently stripped
and the draft passed. Once the gate became strict, opening a pinned view in the
editor reported unrecognized keys — while the SERVER accepted the very same body,
because it validates against `ViewMetadataSchema`. The client was strictly
stricter than the server; the direction was inverted.

`validateMetadataDraft` now takes an optional `{ mode: 'create' | 'edit' }`.
Create keeps the authoring gate unchanged. Edit is judged by
`ViewMetadataSchema` — the schema the `view` metadata type registers, i.e. the
same one the server runs — so the client and the server accept the same set by
construction. `mode` defaults to `'create'`, the strict gate, so a caller that
omits it can only ever over-report, never silently widen the door.

The edit gate keeps its teeth: a wrong `config.type` and a container carrying an
unknown key are both still rejected.
