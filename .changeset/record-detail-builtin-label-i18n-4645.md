---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/i18n': minor
---

The built-in record-detail tab labels and the last two English landmark names now speak the session locale (objectui#4645).

`buildDefaultPageSchema` synthesizes the record-detail tab strip with plain
English tokens on the nodes (`Details`, `Related`, `Attachments`, `Activity`,
`History`, `Approvals`), and three of its own comments said those tokens
"localize through the tab strip's `KNOWN_LABEL_DICT`". That dict shipped
exactly two arms — `zh-CN` and `zh-TW` — so the claim held for Chinese and
silently failed for the eight other shipped packs: a ja-JP or es-ES record
detail rendered `Details / Related / Attachments` inside otherwise fully
localized chrome, measured in a real browser on `@objectstack/console` 17.0.0
GA and re-measured red on current `main`.

Every one of those strings was already in all ten packs (`detail.details`,
`detail.related`, `detail.activity`, `detail.history`, `detail.attachments`,
`detail.approvalsPanelTitle`); the strip simply never asked. It asks now,
BEHIND the exact-locale dict, which stays first because `zh-TW` has no pack of
its own — i18next resolves it to the Simplified `zh` resource, so the dict is
the only source of the Traditional forms — and because it carries tokens
(`Notes`, `Files`, `Tasks`, `Events`, object names) that no pack does. `en` and
`zh` render byte-identically to before; the other eight locales change from the
English token to their pack value. `page:accordion` reads the same lookup, so
the two renderers cannot answer differently for one token.

Alongside it, the two `aria-label`s that were English in *every* locale —
`HeaderHighlight`'s `Record highlights` and `RecordActivityTimeline`'s
`Discussion` — now route through the bundle. Both sections carry no visible
label, so the `aria-label` is the landmark as far as assistive tech is
concerned (the argument objectui#4024 made for the dialog `Close` label, and
objectui#5956 made for `record:path`'s own container name). `detail.discussion`
already existed in all ten packs; `detail.highlightsLabel` is the single new
key, added to all ten and mirrored byte-identically into
`DETAIL_DEFAULT_TRANSLATIONS`.
