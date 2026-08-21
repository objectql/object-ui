---
'@object-ui/plugin-detail': patch
---

`record:alert`'s renderer-local `RecordAlertProps` CTA slot (`action.label`) is
widened to `string | I18nLabel` in both copies (`properties.*` and the flat
compat mirror) in `packages/plugin-detail/src/renderers/record-alert.tsx`.

The renderer already resolves `action.label` through the same inline-locale-map
`pickLocalized` call as `title` / `body` (`const ctaLabel =
pickLocalized(props.action?.label, language)`), so a bare `string` declaration
was narrower than the renderer's own runtime behavior — the same
declaration-narrower-than-the-renderer contradiction objectui#4970 fixed for
`title` / `body` one level up in the same interface (objectui#4998).

Type-only: the block's published authoring surface still declares `action` as
a bare `object` with the member shape in prose only
(`plugin-detail/src/index.tsx`), so there is no manifest arm to align yet —
that half stays parked on the `ComponentInput` member-shape question (PR
#3795) and is out of scope here.
