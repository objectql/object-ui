---
"@object-ui/app-shell": patch
---

Page block inspector: the input hints inside the properties panel follow the session's language

objectui#3913 turned `block-config.ts`'s `label` / `addLabel` / option labels into
translation keys and stopped at the column next to them. The 8 `placeholder`
values that are prose stayed display text, so a zh-CN admin opening `page:header`
read 「图标」 over a box hinting `lucide icon name`, and `record:details`'
「名称（i18n 键）」 over `snake_case, e.g. contact_info` — in the panel #3913 and
objectui#3963 had just finished translating. Those 8 are now keys under
`engine.inspector.pageBlock.placeholder.<blockType>.<field path>`, resolved by
`PageBlockInspector` at render, with en-US and zh-CN both defined. The en-US text
is byte-identical to the literals it replaces, ellipsis included, so an English
admin sees no change.

The column could not simply follow `label`, and that is the design half of this
change: it is a MIXED surface. Of the 18 placeholders, 10 are example VALUES — a
row count `20`, `https://…`, the inline-action sample
`{ "type": "url", "target": "/environments" }` — and translating those would be a
defect, not a courtesy. A localized JSON sample is metadata `InlineActionSchema`
rejects, and a "translated" default row count means nothing at all.

So which kind a placeholder is, is declared in the type rather than left to a
convention plus a list of exceptions:

    placeholder?: { key: string } | { literal: string }

A bare `placeholder: 'lucide icon name'` — the shape this file used until now,
and the first thing anything generating a new field reaches for — no longer
compiles. That matters more than the eight strings: `type-check` runs in every
lane and in the editor, so the mistake is caught where it is made instead of
becoming an English box in a Chinese panel that waits for a reviewer to notice.
`addLabel` was made required for the same reason in #3913; `placeholder` stays
optional, because a field with no hint is legitimate.

The keyed half joins the derivation pin
(`previews/__tests__/block-config-i18n.test.ts`) as a fifth key family, so a new
prose placeholder without a translation is red rather than shipping. The literal
half is pinned as an inventory with a reason per entry, because "finish
translating the other ten" is the plausible next edit and it needs to argue with
a test first. `block-config.test.ts`'s snake_case assertion moved from the raw
placeholder to the RESOLVED hint in both locales, which is now the stronger
statement: the `snake_case` token has to survive translation, not merely exist in
English.
