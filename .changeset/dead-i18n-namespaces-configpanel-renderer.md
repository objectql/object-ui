---
'@object-ui/i18n': patch
---

Delete two dead i18n namespaces — `configPanel.*` (16 keys) and `renderer.*` (13 keys) — from all ten locale packs.

290 translated strings (29 keys x 10 packs) with **no reader anywhere in the
repo**. Measured with `node scripts/check-i18n-dead-keys.mjs`, the reverse sweep
from objectui#4658: it subtracts the referenced key set (the AST walk that
`check-i18n-call-site-keys.mjs` already uses, plus plural suffixes, plus
`returnObjects` branches, plus every dynamic template head) from the pack key
set, then re-checks each survivor with a fixed-string grep over the whole repo.
Both namespaces scored a clean sweep — `configPanel.*` 16/16 CONFIRMED and
`renderer.*` 13/13 CONFIRMED, zero NEEDS-REVIEW, and a fixed-string grep for all
29 keys returns nothing at all outside `packages/i18n/src/locales/`.

`configPanel.*` is a dashboard-widget config-panel vocabulary (`layout`,
`columns`, `gap`, `rowHeight`, `refreshInterval`, `appearance`, `theme`,
`general`/`advanced`, …). The two components that surface exactly that
vocabulary — `packages/plugin-dashboard/src/WidgetConfigPanel.tsx` and
`DashboardConfigPanel.tsx` — import no translation hook at all and hardcode the
same words in English (`title: 'Layout'`, `label: 'Columns'`, `label: 'Gap'`,
`label: 'Show description'`, `label: 'Theme'`). The two config panels that do
use i18n read other namespaces: `ViewConfigPanel.tsx` reads
`console.objectView.*`, `ReportConfigPanel.tsx` reads `common.*` and
`report.editor.*`. No component reads `configPanel.*`.

`renderer.*` is SchemaRenderer placeholder/status vocabulary (`noPageSchema`,
`noFormSchema`, `noDashboardSchema`, `pageRendering`, `dashboardRendering`,
`formRenderingMode`, …). It is dead in the stronger sense: the English strings
have no hardcoded twin either — `No page schema provided`, `No form schema
provided`, `No dashboard schema provided`, `Page rendering`, `Dashboard
rendering` and `Form rendering in` each return zero hits repo-wide outside the
packs, and `packages/react/src/SchemaRenderer.tsx` imports no translation hook.
The messages themselves are gone from the product, not merely un-translated.

No behaviour change is possible: a key with no reader cannot be read. No test
fixture pinned any of the 29 keys, and neither i18n baseline JSON names one, so
nothing else had to move.

Part of #4730.
