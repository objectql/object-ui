---
'@object-ui/app-shell': minor
---

A `type: 'modal'` action's string `target` names a PAGE, only — the object fallback retires

`useActionModal.resolveModalTarget` resolved a string target page-first and then
fell back to the OBJECT metadata, opening a create/edit form for an object of
that name. Riding the same branch was a `create_`/`new_`/`add_`/`edit_`/`update_`
prefix convention: `create_opportunity` was parsed into the object `opportunity`
in `create` mode whenever no page owned the literal name.

Both retire (maintainer ruling on objectstack#6739, 2026-08-09). The contract was
never ambiguous — the spec TSDoc (`packages/spec/src/ui/action.zod.ts`), the
published docs (`content/docs/ui/actions.mdx`) and `defineStack`'s cross-reference
walk (`packages/spec/src/stack.zod.ts`) all say a modal target names a page, and
the walk REJECTS a registered modal action whose target is not a declared page.
The fallback was consumer leniency on top of that: it made the runtime serve
exactly what the build gate refuses, so an authoring mistake opened something
plausible instead of failing, and the corpus learned the wrong shape from it
(objectstack#6737's showcase line built only because it leaned on this branch and
on a validation hole in inline-action checking, both at once).

The ruling explicitly declined the middle shape — keep the prefix, reject bare
object names — because a name-shaped guess is the authoring hazard the contract
exists to remove. `create_opportunity` now names the page `create_opportunity`,
or it names nothing.

**Breaking surface.** A `type: 'modal'` action whose `target` names an OBJECT
(bare, or under a verb prefix) no longer opens that object's form. It is refused,
with a diagnostic naming the refused target and pointing at the replacement.
Opening an object's form from an action is `type: 'form'` with an
`object.view` FORM-view target — the same capability, validated end-to-end
(a form target pointing at a LIST view is itself a build error, objectstack#2554).

Not affected, because neither is a modal action's `target`:

- the lookup field's inline "create the referenced record" path, which hands the
  runner a fully-formed `{ objectName, mode }` DESCRIPTOR whose object identity
  comes from the field's `referenceTo`. `ModalDescriptor.objectName` was
  re-judged with this change and KEPT — its "Back-compat" label was simply
  wrong, and it is documented now as the descriptor-only key it has always been;
- a modal action targeting a real page, which resolves exactly as before.
