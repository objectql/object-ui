---
'@object-ui/i18n': patch
---

The merged `Loading…` group now reads one way per language (objectui#5972).

objectui#3878 converged every pack on the typographic ellipsis, and in doing so **merged**
the ASCII `Loading...` group into the U+2026 `Loading…` group. Nobody re-measured the
wording afterwards. Re-derived on today's tree by flattening all ten packs and comparing
exact values, the group is 10 keys — `lookup.loading`, `common.loading`,
`fields.recipient.loading`, `grid.import.historyLoading`, `grid.bulk.loading`,
`detail.loading`, `report.loading`, `dashboard.loading`, `auth.device.loading`,
`approvalsInbox.loadingMore` — and `de` rendered them four ways, `ko` two and `ar` two,
while en/zh/ja/fr/es/pt/ru were already unanimous.

Three packs move, translation copy only — no key is added or removed, no `en` value
changes, and every value keeps its U+2026:

- **de** → `Wird geladen…` on `detail.loading`, `report.loading` (were `Laden…`) and
  `approvalsInbox.loadingMore` (was `Lädt…`). The passive is both the group majority and
  the pack's dominant register for in-flight states generally.
- **ko** → `로딩 중…` on `fields.recipient.loading`, `grid.bulk.loading`,
  `grid.import.historyLoading` and `approvalsInbox.loadingMore` (were `불러오는 중…`).
  Majority, and it matches the pack's own pattern: `불러오는 중` is what `ko` uses when the
  string names the thing being loaded, the bare form is `로딩 중`.
- **ar** → `جارٍ التحميل…` on `common.loading` and `detail.loading` (were `جاري التحميل…`).
  This one is an orthography normalization rather than a wording choice: `جارٍ` is the
  indefinite منقوص participle with tanwīn on the rāʾ, `جاري` the yāʾ-retaining form.

`de` `auth.device.loading` deliberately stays `Lade…`. It is the one member whose outlier
spelling is coherent with its own screen: `DeviceAuthPage` renders that namespace's three
in-flight states together and `de` writes all three in the same first-person voice
(`Genehmige…`, `Ablehne…`, `Lade…`), the other two being outside this group. Converging it
alone would manufacture a fresh same-screen inconsistency, so it is reported as a fork and
pinned as a named exemption instead.

`packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` gains the per-language
uniformity pin beside the glyph rule that created the group. The pin derives the group
from `en` and asserts its membership and per-language value counts **before** asserting
uniformity, so it cannot pass by matching nothing.
