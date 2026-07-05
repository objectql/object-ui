---
'@object-ui/plugin-view': patch
'@object-ui/app-shell': patch
---

Consolidate the record-surface mirror onto `@objectstack/spec/data` (objectui#2269 debt paydown).

`plugin-view/src/recordSurface.ts` re-exports `deriveRecordSurface` / `deriveRecordFlowSurface` / `countAuthorableFields` / `RECORD_SURFACE_PAGE_THRESHOLD` + types from `@objectstack/spec/data` instead of carrying a hand-kept copy — the local mirror only existed because objectui pinned a spec (`^11.7`) predating those exports, and the pin is now `^12.2`. The objectui-local overlay-size helpers (`deriveOverlaySize` / `overlayWidthFor` / `OverlaySize`, a renderer width concern the protocol doesn't own) stay local but reuse spec's `countAuthorableFields`. `RecordSurface` widens to spec's `'page' | 'modal' | 'drawer'` (the heuristic still only emits page/drawer); `resolvePostCreateTarget`'s `surface` param accepts the wider type and treats `'modal'` like a drawer. Behavior is unchanged (mirror unit tests pass verbatim against the re-exported functions); console production build resolves the subpath import.
