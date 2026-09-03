---
'@object-ui/app-shell': patch
'@object-ui/plugin-view': patch
---

Relay a per-view `rowColor` through the two object-view hosts (objectui#7218).

`rowColor` is a declared member of `ListViewSchema` — imported by reference from
`@objectstack/spec`, shape `{ field, colors? }` — and `ListView` reads it to
seed its `rowColorConfig` state, which colours whole rows from the named field's
value. Neither object-view host relayed it: `app-shell`'s
`ObjectView.renderListView` builds its list schema by spreading the host's and
then relaying 47 named keys off the active view, and `plugin-view`'s
`ObjectView` assembles 46 inside its `object-view HOST-COMPOSITION SURFACE`
fence. `rowColor` had a rung in neither.

So an authored per-view row colour was unreachable on the object route:
authored, validated, built and served correctly, then dropped at the relay.
Nothing errored and every authoring gate passed — the only symptom was that the
rows were not coloured, which an author cannot notice short of diffing the DOM.
Same "declared and inert" shape objectui#7199 fixed for `description`.

**This is a relay, not a new surface.** The interface route
(`InterfaceListPage.tsx`) has shipped `rowColor: view.rowColor` next to
`grouping` and `pagination` since ADR-0047, into a schema typed
`ListViewSchema`, with no fence of any kind — so the key was already
author-reachable and already had a delivery path; two of three hosts simply did
not use it. The legacy shorthand for the same feature (bare `color`) already had
a rung in both literals; only the spec-canonical spelling was missing.

**No published surface moves.** Both rungs are view-sourced only, and neither
adds a cast read off the object-view node — that would have added a 28th name to
the objectui#5097 HOST-COMPOSITION exemption whose count the 2026-08-18 ruling
fixed at 27, which is a ruling and not a refactor. `grouping` is the in-fence
precedent for a view-only rung.

⚠️ Not `userActions.rowColor`, a boolean permission toggle sharing this name at
a different nesting level ("may the user open the colour panel" versus "what the
colours are"). That key is untouched, and the new pins hold the two apart.
