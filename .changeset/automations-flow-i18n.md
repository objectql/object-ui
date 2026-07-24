---
"@object-ui/app-shell": patch
---

feat(app-shell): localize the automations flow designer & inspector (en-US + zh-CN)

Comprehensive zh-CN localization of the metadata-admin automations surfaces —
the visual Flow designer, node/edge inspector, validation, and the shared editor
panels shown on the flow screen. Client-side per the platform's
`translateMetadataType` precedent; en-US is unchanged (every zh overlay falls
back to English, so unknown/plugin values are never hidden).

- Flow designer: node palette (labels/hints/categories + Chinese search), canvas
  chrome & tooltips, header pills incl. enum values, preview panels, run-history
  & debug simulator, nested-region tray, and localized default labels for
  newly-created nodes.
- Node & edge inspectors: config-field labels / help / options / column headers
  for the full engine-published `configSchema` field set (loop
  `indexVariable`/`maxIterations`, http `durable`/`signingSecret`, connector flat
  ids, notify's config fields, …), keyed off the raw node type so aliased types
  localize correctly.
- Structural + unknown-reference validation messages (canvas banner, Problems
  panel, debug simulator) and the Problems-panel chrome.
- Generic `SchemaForm` enum-option / raw-field-label localization used on the
  flow property form, plus the History / Audit / References / Layered-diff panels
  and the force-save dialog shown on the flow screen.
