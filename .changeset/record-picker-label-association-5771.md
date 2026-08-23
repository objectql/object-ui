---
'@object-ui/components': patch
---

`element:record_picker`'s `label` is now programmatically associated with its
`SelectTrigger` combobox — fixing a case where the caption the block's own
registration prose advertised (`'Caption rendered above the picker, in a
<label> element'`) named nothing at all (objectui#5771).

Pre-fix, the render body was `{label && <label className="…">{label}</label>}`
against a `SelectTrigger` with no `id`: neither end of the association carried
any wiring. That is a step worse than the sibling gap objectui#5735 closed on
`element:text_input` — there the `label` half was already correctly wired and
only `description` was adrift; here the label element had no `htmlFor` and the
trigger had no `id`, so the picker had no accessible name unless a
`placeholder` happened to render text into the trigger's content.

The fix follows the shape objectui#3341 already ruled on for the same defect
class (`InlineCreateRelated`'s `<label>`/`<Input>` pair) and objectui#5735
just landed on the complement block: `htmlFor`/`id` against the
`SelectTrigger` — a `button` with `role="combobox"`, and therefore labelable,
so no `aria-labelledby` is needed (Radix sets none on the trigger) — wired
**when `schema.id` exists**, matching `element:text_input`'s precedent rather
than an always-on `useId()` fallback. Only the author can supply `schema.id`,
so a picker authored without one keeps its pre-fix, unassociated caption text
exactly as before; nothing about this change mints an id the author did not
provide. The `<label>` element itself is also swapped for the shared `Label`
(`@radix-ui/react-label`) primitive `element:text_input` already uses for the
same wiring, rather than a bare `<label>` with a `htmlFor` bolted on.

The registration prose for `label` is corrected to describe what the code now
does (tied to the control by `htmlFor` when the node carries an `id`) instead
of a caption association the renderer never performed.
