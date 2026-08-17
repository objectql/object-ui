---
'@object-ui/app-shell': patch
---

The metadata editor's reset/delete button now renders the verb it executes, decided by the server's own verdict.

One control, two independently hand-rolled artifact predicates. The render side
asked the page's two-tier `isArtifactItem` — which excludes the `sys_metadata`
save-path sentinel and ADR-0010 `provenance: 'org'` — while `doReset()` asked a
looser one of its own, `layered?.code != null`. For a published org-own entry
those disagree, because that entry's `code` layer IS its own rehydrated
`sys_metadata` row: the button drew a trash can titled "Delete", then asked
"Reset overlay for …?" and took the reset branch, leaving the operator on a page
for an entry the request had just destroyed. PR #4885 did not introduce this and
does not fix it, but it widened the population that can see the button.

Both sides now read ONE value, and it is the one the server already computes and
ships on the layered envelope (`resolveLockState`: `resettable = artifactBacked`).
Icon, `title`, confirm text and the branch taken can no longer disagree about the
same entry. Two facts were measured before the change rather than assumed: for an
entry with no artifact baseline the `DELETE /meta/:type/:name` that this button
issues hard-deletes the `sys_metadata` row (there is nothing to reset *to*), and
for exactly that population the server answers `resettable: false` — so delete is
the honest verb, and the confirm dialog is the consent gate. This is the
maintainer's 2026-08-17 ruling on objectui#4886.

Two consequences are behavior changes, stated because they are not merely fixes.
`resettable` is read as an honest tri-state: `undefined` means the server has no
opinion (a pre-ADR-0010 envelope), and instead of the old
`layered?.resettable !== false` collapse into "resettable" — which promised a
baseline that may not exist — the page falls back to its own conservative tier,
the same value the render side already used, so a legacy server keeps its legacy
rendering and both sides still move together. And the button's lock gate is now
`deletable` for both verbs: reset and delete are the same request, and the server
gates it once, through `evaluateLockForDelete`. A `_lock: 'no-delete'` artifact
item therefore stops offering a Reset button the server would answer with
`403 ITEM_LOCKED`.
