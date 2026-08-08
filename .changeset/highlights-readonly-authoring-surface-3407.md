---
"@object-ui/plugin-detail": patch
---

`record:highlights` publishes the `readonly` entry key, so an AI author can discover it from the manifest

`readonly` on a `fields[]` entry has been enforced for a while — the renderer copies it
through normalization and `HeaderHighlight`'s editability gate refuses inline editing on a
chip carrying it (objectstack#5077) — and `@objectstack/spec` declares it on
`RecordHighlightsField` (objectstack#5176 / PR #5607). The block's own published authoring
surface never mentioned it: the `fields` input still spelled the entry shape
`{name,label?,icon?,type?}`, and since the registry `inputs` are what
`gen-manifest.ts` serializes into `sdui.manifest.json`, an author reading the manifest was
told the key did not exist. The `fields` description now states the full entry shape and
what `readonly` does, which is the discoverability the manifest is for.

`readonly` is documented **inside** the `fields` description rather than declared as an
input of its own, because that is where the contract puts it. The spec's
`RecordHighlightsProps` has exactly three top-level keys (`fields`, `layout`, `aria`) and
carries `readonly` per ENTRY. A top-level `{ name: 'readonly', type: 'boolean' }` input
would publish a key the platform silently discards: the generated `sdui.manifest.json` and
`sdui-intrinsics.d.ts` would advertise a `readonly` prop, the manifest gate validates
top-level props only and would raise no diagnostic, `RecordHighlightsProps` is a plain
`z.object` so the unknown key is stripped on parse without error, and the renderer — which
reads `field.readonly` per entry — would never see it. An author who trusted that surface
would be left with the machine-owned column still hand-editable and no diagnostic anywhere
explaining why. `ComponentInput` is flat by design, so an array-of-objects input publishes
its member keys in prose, as `record:path.stages` and `record:alert.action` already do.

A new spec-parity test derives both directions from `@objectstack/spec` at runtime instead
of restating today's key list: every key of `RecordHighlightsField`'s object arm must be
named in the `fields` description, and the block must declare no top-level input that
`RecordHighlightsProps` does not accept. Nothing previously cross-checked the registry
`inputs` against the spec, so both drift directions were silent. No runtime behaviour
changes.
