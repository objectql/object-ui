---
'@object-ui/plugin-form': minor
'@object-ui/types': minor
---

⚠️ **Behaviour change: an authored `FormSection.visibleWhen` that has been doing nothing
will now START HIDING SECTIONS.** Read this before upgrading if any of your metadata
authors a section predicate.

`@objectstack/spec` declares `FormSection.visibleWhen` and this repo's spec bridge maps it
through, but every plugin-form layout renders a section header as a virtual
`section-divider` pseudo-field and none of them copied the predicate onto it. On the
object-view chain — the create/edit modal, the drawer, the split form, and the full-page
record form — the key was declared, mapped, carried, and then dropped one hop before
anything could evaluate it. The section rendered unconditionally, with no diagnostic
(objectui#6111).

**Why nobody noticed, and why the fix is felt as a regression.** `visibleWhen` fails OPEN:
a section that renders is what you get when the predicate resolves TRUE, when the predicate
never arrives, *and* when the predicate faults. Those three worlds were indistinguishable,
so an app that authored a section predicate saw its section render and had no way to tell
that the rule was inert. Every such app has been running with the rule switched off, and
some will have been authored — or simply grown used to — that state. After this change the
predicate is evaluated for real, and sections that have always been visible will disappear
for the users the rule excludes.

This is the intended ADR-0089 contract being delivered, not a new capability: the key was
already declared, already documented, and already honoured by the console form renderer.
The object-view chain was the one that silently ignored it.

**Before upgrading**, audit any `sections[].visibleWhen` in your form-view metadata and
confirm each predicate says what you actually want, evaluated against `record` +
`current_user`. A predicate that was written speculatively, or left behind after a rework,
now takes effect.

**Measured scope of the hide.** The predicate gates the section's HEADER row. The renderer
treats `section-divider` as presentational and holds no association between it and the
fields that follow it, so a false predicate removes the heading and the section's fields
keep rendering. The console renderer (`apps/console`) drops the whole `<section>`, fields
included. That divergence is real, is pinned honestly by this change's tests rather than
implied away, and is filed separately — it needs a renderer-side grouping contract, not
another line in a layout.

Two hops were dropping the key and both are repaired: `ObjectForm` rebuilds each section
key by key when it delegates to Split/Drawer/Modal (and `ModalForm`'s own `groups` map does
it again), so a key those maps did not copy never reached the layout at all; and the six
`section-divider` synthesis sites across the four layout files.

`@object-ui/types` gains the matching `ObjectFormSection.visibleWhen` declaration.
