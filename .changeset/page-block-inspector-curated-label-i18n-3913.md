---
"@object-ui/app-shell": patch
---

Page block inspector: the PROPERTIES panel's curated field labels now follow the session locale instead of always rendering English

`PageBlockInspector`'s chrome went through the translation table from the start —
`t('engine.inspector.pageBlock.properties')` and its siblings — while the panel's
CONTENTS did not. Every `label` in `previews/block-config.ts` was an English
literal handed straight to the field components, so a zh-CN admin opening any
page block read 「属性」 over a stack of English field names: two languages in one
panel, reproducible on any block with no special data.

All 157 label literals (152 field/option labels + 5 `addLabel`s) are now
translation keys resolved through `t(key, locale)` at render, with 154 distinct
keys added to both the `en-US` and `zh-CN` sides of
`views/metadata-admin/i18n.ts`. The English text is unchanged: every key's `en`
value is the literal it replaced, verified by substituting all 157 keys back and
diffing the result byte-for-byte against the pre-change file.

The key is a function of the label's POSITION in `BLOCK_CONFIG`
(`engine.inspector.pageBlock.field.<blockType>.<name>`, `.add.<blockType>.<name>`,
`.option.<fieldName>.<value>`), and a test re-derives all three shapes from the
table's own structure. That is what makes the realistic mistake visible: these
keys differ by one segment, so adding a block by copy-pasting a neighbour's key
yields a key that EXISTS in both locales and renders a plausible label belonging
to a different property — an existence-only check is green for it. Positional
keys also let one English word take different Chinese per block, which the panel
needs: `element:button.label` is a button caption 「按钮文字」 while
`page:tabs.items.label` is a tab title 「标签」, and `Add section` is 「添加分区」
here but stays 「添加分组」 in the form-layout canvas.

`addLabel` is now REQUIRED on the `array` field variant. It was optional and the
inspector fell back to a bare English `'Add'` — an untranslatable literal no
locale table could reach. Requiring it deletes the fallback instead of
translating it, so a new array field cannot compile without naming its
add-button key.

Option labels are translated too, including the ones `ColorVariantPicker` renders
only as `aria-label`/`title`, where an untranslated string is invisible to a text
query.
