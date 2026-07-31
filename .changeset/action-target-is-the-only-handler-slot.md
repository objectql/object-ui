---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/components': minor
'@object-ui/app-shell': minor
---

**`target` is the only action handler slot — the `execute` alias is gone from the renderer (framework#3856).**

`ActionRunner.executeScript` read `action.target || action.execute`. That fallback
is unreachable against `@objectstack/spec` 17: `execute` is now a tombstoned key
(framework#3855) that the parser **rejects** with the rename prescription, so no
parsed action can carry it and the `||` could only ever yield `target`. Verified
against 17.0.0-rc.0 — an action declaring `execute` fails `ActionSchema.safeParse`,
and a `target` action's parsed output has no `execute` key at all.

Deleted rather than left as harmless residue: two handler slots is what let one
action run one script server-side and a different one client-side (framework#3713,
where this renderer preferred the alias while the spec transform preferred
`target`). A dead slot still reads as a live contract to the next maintainer.

`execute` is also **removed from the types**, which is the part that had never
landed. framework#3856 predicted a compile error here; there wasn't one, because
neither reader was typed against the spec's `z.infer`:

- `@object-ui/types` `ActionSchema` hand-declared `execute?: string`. Removed, so
  `execute: '…'` now fails `tsc` at the authoring site (TS2353).
- `@object-ui/core` `ActionDef` hand-declared it too. Removed — but `ActionDef`
  carries a `[key: string]: any` index signature, so stale hand-authored metadata
  that never passed through the parser still compiles. For that path
  `executeScript` now returns the rename prescription instead of a bare
  "No script provided", matching the spec tombstone's rule that removing an
  authorable key must be audible: silently binding no handler is the
  "Mark Done does nothing" shape (framework#2169).

The four action renderers (`action:button`, `action:icon`, `action:menu`,
`action:group`) no longer forward `execute` into the runner, and Studio's
`ActionPreview` no longer falls back to it — previewing an alias-only draft as
"bound" contradicted the parse that rejects it on save.

Requires `@objectstack/spec` 17. Metadata still on the alias is rewritten by
`os migrate meta --from 16`.
