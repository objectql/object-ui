---
'@object-ui/core': patch
---

The dev-mode unknown-key warning stops flagging `overrideNotice`, the console's
privileged-override safety copy (objectui#5611).

`ActionRunner.execute` classifies the object it was HANDED, and a console host
hands it a DISPATCH, not a stored metadata row. `DeclaredActionsBar` composes
`overrideNotice` on that dispatch and two param-collection handlers read it —
yet the key inventory only mirrored AUTHORED surfaces, so the runner reported a
key two files read as one "no reader recognizes", and prescribed promoting it to
an explicit field on `ActionDef`. That prescription is the one shape the
2026-08-22 maintainer ruling forbids for this key, so acting on the diagnostic
walked an author into a rejected design. A false warning on the product's own
privileged path — the branch that finalises an approval over approvers who have
not acted — is how a dev console gets muted.

Adds an exported `HOST_DISPATCH_ACTION_KEYS` (sole member `overrideNotice`) to
`actions/actionKeys.ts` and unions it into `KNOWN_ACTION_KEYS`, which is the
fourth input to that set and the first one that is not an authored-surface
mirror. Measured before and after on the exact dispatch the bar composes: the
warning went from one call naming `overrideNotice` to none, `KNOWN_ACTION_KEYS`
grew by exactly one member, and an action carrying a real typo alongside it
still warns — naming `targt` only.

The authored surface does not move. `overrideNotice` is still NOT declared on
`ActionDef` and still NOT in `ACTION_DEF_KEYS`; writing it in an action literal
remains a compile error, and the AST-derived pin over the interface is unchanged.
Membership in `KNOWN_ACTION_KEYS` widens what the WARNING tolerates, never what
an author may write — `actionKeys.pin.test.ts` now pins both halves, including
the new list's exact contents so a second member cannot arrive quietly.
