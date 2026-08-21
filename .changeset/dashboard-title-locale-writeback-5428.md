---
'@object-ui/plugin-designer': patch
'@object-ui/app-shell': patch
---

A widget title stored as an inline per-locale map is editable again in both dashboard
authoring surfaces, and a save writes back only the active locale's entry
(objectui#5428).

`@objectstack/spec` widened `I18nLabel` from `string` to `string | Record` at
17.0.0-rc.6, so a stored widget title may be an inline per-locale map while both
authoring panels edit a title in ONE single-line input. Writing the input's value back
as the whole value would collapse every other locale on the first keystroke, so both
surfaces took the same conservative branch: show a map-valued title resolved, and make
it READ-ONLY.

That branch could not lose data, but it rested on a premise the spec had already
invalidated — "nothing can reach this path from stored metadata yet, `I18nLabel` was
plain `string` through rc.5" — stated sixty lines below a comment in the same file
documenting the rc.6 widening that makes a stored map reachable. Both could not hold.
The pinned spec is 17.0.0. What the read-only branch did in practice from rc.6 onward
was not protect an unreachable path: it denied an author the ability to edit a widget
title in their own locale.

objectui#5301's maintainer ruling settled the write rule for the sibling surface — a
save replaces only the active locale's entry and preserves the others — and
`@object-ui/i18n` ships it as `setLocalized`, co-located with `pickLocalized` because
the read and the write have to agree. Both panels now adopt it:

- `@object-ui/plugin-designer`'s `DashboardEditor` widget property panel;
- `@object-ui/app-shell`'s `DashboardWidgetInspector` in metadata-admin.

A plain-string title keeps saving as a plain string, so the common path is unchanged.
An edit made in a locale the stored map does not carry ADDS an entry under that locale
rather than overwriting the entry the display fell back to.

The pins are preservation pins, not "the input is editable" pins: at both surfaces a
keystroke on a map-valued title must leave every other locale's entry byte-identical.
Reverse-verified by mutating each write back to the flattening form and confirming those
assertions go red at both surfaces.

Not a multi-locale editor: an author still reaches only the entry for the locale they
are in. Authoring every locale from one panel remains an open product question. The
stale deferrals both comments carried pointed at objectui#4163, which closed as
completed on 2026-08-15 while the placeholders were still in the tree; they are replaced
with the rule that is actually in force rather than re-pointed at another tracker.
