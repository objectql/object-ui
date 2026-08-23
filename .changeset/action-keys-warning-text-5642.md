---
'@object-ui/core': patch
---

The dev-mode unknown-key warning stops stating a fact that was retired, and
sends the author to the file that actually declares the interface
(objectui#5642).

Both halves of the message's tail had outlived the change they described. It
told the author the key was warned about rather than rejected because
`ActionDef` "still carries `[key: string]: any`" — objectstack#4075 step 3
deleted that index signature, and `actionKeys.pin.test.ts` pins the deletion in
the opposite direction (`{ ActionDef: false, ActionContext: true }`), while
`actionDef-closed-surface.test.ts` pins that `tsc` now rejects exactly such a
key at the construction site. And it prescribed promoting the key to an explicit
field on `ActionDef` "(packages/core/src/actions/actionKeys.ts)" — that file
holds the INVENTORY (`ACTION_DEF_KEYS`); the interface is in `ActionRunner.ts`.
The wrong pointer had teeth: an author who followed it edited the inventory
alone, which is precisely the half-change the pin test reddens on, since it
re-derives the inventory from the interface's AST.

The tail now carries the reason the module's own header already gives for why
this warning survived step 3 — the two mechanisms cover disjoint populations.
`tsc` sees action literals authored in code; the warning sees actions that
arrive as data, from stored rows that are rehydrated unparsed and that no
compiler ever looked at (objectstack#3903). The prescription names
`ActionRunner.ts` for the field and `ACTION_DEF_KEYS` as the same-commit second
edit, saying why.

No behaviour change: the classification logic, the key inventory and its
derivation are untouched, and the warning fires on exactly the same actions as
before. Two comments in the same file and two in the pin test that described the
pre-step-3 world were refreshed in the same pass, and the message text is now
pinned — the printed interface path is resolved off the message and read, so a
move or rename reddens by name instead of shipping a second dead prescription.
