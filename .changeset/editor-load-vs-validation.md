---
"@object-ui/app-shell": patch
---

Metadata editor: a failed LOAD no longer masquerades as field validation errors.

When the layered/draft fetch fails (network/500/timeout), `ResourceEditPage` previously still rendered the form on empty defaults, so the client Zod validator fired spurious "name/label/regions required" diagnostics — making a transport failure look like a structurally broken item.

- New `loadFailed` state, set in the load catch block and reset at the start of each load.
- The validation-diagnostics banner is now gated by `shouldRenderDiagnostics()`, which suppresses the diagnostics block entirely on load failure, so the empty-default form's required-field issues never surface.
- The top error banner is now explicit: "Failed to load &lt;type&gt;/&lt;name&gt;: &lt;message&gt;" (new `engine.edit.loadFailed` i18n key, en + zh-CN).

The happy path is unaffected: a genuinely-invalid item that loaded successfully still shows its validation diagnostics.
