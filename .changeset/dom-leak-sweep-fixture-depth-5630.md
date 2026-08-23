---
---

Test-only: deepen the `element:definition-list` / `element:repeater` /
`element:metadata_viewer` fixtures in the DOM-leak sweep
(`packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx`) past their
empty-state placeholder branch, so their clean reading covers the real,
populated markup instead. No renderer source changed and no published
behaviour changes.
