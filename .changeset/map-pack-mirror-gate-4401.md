---
'@object-ui/plugin-detail': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-designer': patch
---

Inline-edit toggle reads "Edit fields" without an I18nProvider, matching every locale pack

`DETAIL_DEFAULT_TRANSLATIONS` said `Edit fields inline` where all ten packs say
`Edit fields`, so `InlineEditSaveBar`'s toggle announced two different names for one
control — the map's on provider-less hosts (standalone embeds, the preview gallery),
the pack's in the console. The pack wins; the map row now mirrors it byte for byte.

The three ungated defaults maps (`plugin-detail`, `plugin-list`, `plugin-designer`) are
now compared key-by-key against the `en` pack by a new gate, generalizing the
collaboration-only precedent from objectui#3440. `LIST_DEFAULT_TRANSLATIONS` and
`DESIGNER_DEFAULT_TRANSLATIONS` are exported for it, as `DETAIL_DEFAULT_TRANSLATIONS`
and `COLLAB_DEFAULT_TRANSLATIONS` already were.
