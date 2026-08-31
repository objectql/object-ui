---
'@object-ui/react': minor
---

Expression-bindable text keys: `statistic.value`, `card.title`, `button.label`
and their siblings now evaluate `${...}` on the node (objectui#4795 Direction 1,
maintainer ruling 2026-08-25).

**What changes for you.** Four text keys — `title`, `label`, `value`,
`description` — can now carry an expression written directly on the component
node, on the component types that declare them:

| Component | Bindable node keys |
|---|---|
| `statistic` | `label`, `value`, `description` |
| `card` | `title`, `description` |
| `button` | `label` |

```json
{ "type": "statistic", "label": "Active users", "value": "${data.metrics.active}" }
```

That node used to render the literal text `${data.metrics.active}`. A dashboard
`statistic` previously had no way at all to bind a dynamic number — the
documented workaround (moving the key under `props`) evaluated the value and
then discarded it, painting a blank card instead. Both shapes are fixed by the
same change: the value is evaluated once, at the single place that produces
evaluated schema, and lands where the renderers already read.

**No component behaviour changed.** `statistic.tsx`, `card.tsx` and `button.tsx`
are untouched — they always read these keys off the node; nothing was writing an
evaluated value there.

**Scope, and how it grows.** The list is closed and lives in
`@objectstack/spec` (`EXPRESSION_BINDABLE_TEXT_KEYS_BY_COMPONENT`); the renderer
reads that declaration rather than keeping a copy. On any other component type
these four keys are still read raw, so an expression reaches the screen as
literal text — notably `text`, whose `value` is read but has no declaration.
Adding a type or a key is a change to the spec, never something the renderer
infers.

**Nothing is newly rejected.** This release only widens what evaluates; no
metadata that used to render now fails to. The build-time rejection of `${...}`
in undeclared keys — the second half of the same ruling — is not in this release
and is still open.

Published authoring guidance updated to match: `skills/objectui/rules/protocol.md`
(new "Bindable Text Keys" rule), plus the `page-builder`, `schema-expressions`
and `data-integration` guides, which taught the now-retired "never evaluated"
statement and its host-pre-resolution workaround.
