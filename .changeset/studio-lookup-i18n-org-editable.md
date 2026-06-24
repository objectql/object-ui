---
"@object-ui/app-shell": patch
---

fix(studio): localize lookup picker config + keep published org objects editable

- The lookup field's "Picker config" sub-panel (display/description field,
  selectable-records filters, depends-on, page size, quick-create) was
  hard-coded English in an otherwise-Chinese designer. Routed every literal
  through `t()`/`tFormat()` with new `designer.field.lookup.*` keys (en + zh).
- A freshly-published org object read back as read-only: after publish its
  active version surfaces in the layered `code` slot tagged with the
  `sys_metadata` provenance sentinel, and `ResourceEditPage` treated any
  non-null `code` as a packaged artifact (needs `allowOrgOverride`, which the
  `object` type lacks). Mirror the server's `isArtifactBacked` — which excludes
  `_packageId === 'sys_metadata'` — so org-authored items stay editable.
