---
'@object-ui/types': minor
'@object-ui/components': minor
---

`MenuItem` is now a discriminated union, and all three menu renderers read the keys it
declares (objectui#6523, objectui#6346, maintainer ruling 2026-08-27 — "one answer for the
whole `MenuItem` family").

**The break, spelled out.** `MenuItem` (`@object-ui/types`, shared by `ui:dropdown-menu`,
`ui:context-menu` and `ui:menubar`) used to be a single object with `label: string`
required unconditionally. It is now `MenuCommandItem | MenuDividerItem`: a command item
(`label` required, plus `icon`/`disabled`/`onClick`/`shortcut`/`children`) or a divider
(`{ separator: true }`, nothing else). The union — not `label?: string` — is deliberate: it
is what the data actually is, and it keeps the command arm's label protection intact rather
than weakening it repo-wide to accommodate the divider. Both arms also tombstone `type`
(`type?: never` / `z.never().optional()`): the retired `{ type: 'separator' }` (and its
sibling `{ type: 'label' }`) is now a **declared refusal** at parse time, not a silent strip.
A consumer's own `MenuItem[]` authored with either retired spelling now fails
`MenuItemSchema.safeParse` and fails `tsc` under the published `.d.ts`; a consumer authoring
the declared `{ separator: true }` divider now **succeeds** for the first time — before this
change it failed a strict parse too, because `label` had no way to be omitted.

**Renderer accept behaviour changes to match.** `dropdown-menu` and `context-menu` used to
branch on the undeclared `item.type === 'separator'`; an author who instead wrote the
DECLARED `{ separator: true }` got a value that validated, published, and rendered a blank
menu row (the divider fell through to the ordinary item branch with no `label`). Both
renderers now branch on `item.separator`, matching `menubar` — which had this right all
along and is the evidence the type, not those two renderers, was correct. Their registry
`defaultProps` and `description` strings stop teaching the retired dialect; the 4 places it
appeared in this repo (2 schema-catalog fixtures, 2 registry `defaultProps`) are migrated.

**The item handler moves to the declared key (objectui#6346).** All three renderers now
fire `item.onClick` — the key `MenuItem` has always declared (TS source, built `.d.ts`, and
the Zod mirror all agreed) but that `dropdown-menu`/`context-menu` never read (they read an
undeclared `item.onSelect` instead) and that `menubar` wired nowhere at all. An author who
followed the published type and set `onClick` got a value that validated, published, and
never fired; that is fixed. `renderMenuItems`/`renderContextMenuItems` also tighten from
`items: any[]` to `items: MenuItem[]` — the widening that let the mismatch type-check in the
first place. Migration cost measured **zero** in this repo: no fixture, doc or test authored
`onSelect` on a menu item before this change.

**Rider, recorded as parity not new capability.** `menubar` now also renders the declared
`shortcut` string — `dropdown-menu` and `context-menu` already drew it, so this aligns the
third container rather than expanding the surface.

Everything that rendered correctly before this change still renders the same way; the
narrowing only refuses spellings that were already unprotected (silently stripped or never
read at all).
