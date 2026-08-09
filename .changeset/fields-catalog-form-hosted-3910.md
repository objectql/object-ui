---
"@object-ui/fields": minor
---

fields: remove the docs-demo registration path (`registerFields` + `createFieldRenderer`), and host the docs field examples in a real form

**Breaking (shipped as `minor` per AGENTS.md §版本号策略 — objectui's major tracks `@objectstack`, so the repo's own breaking changes are `minor` with the break spelled out here):** two public exports are removed from `@object-ui/fields`:

- `registerFields()` — registered every widget under the same `field:<type>` keys as `registerAllFields()`, but wrapped in a demo-only renderer. Two paths writing the same registry keys meant whoever ran LAST won it for every consumer sharing the registry.
- `createFieldRenderer()` — that wrapper. It synthesized a `label`, a description, and a local `useState`/`onChange` around a widget.

**Migration:** there is nothing to migrate for an application. `registerAllFields()` runs on import of `@object-ui/fields` and is the one registration seam (`registerField(type)` for a single type); no shipped application ever called the removed pair — the docs site was the only caller. Code that rendered a **bare field node** standalone (`{ type: 'currency', label: 'Amount' }`) and relied on the wrapper for label and value state must host the field in a form instead: `{ type: 'form', fields: [{ name: 'amount', label: 'Amount', type: 'currency' }] }`. Seed values through the form's `defaultValues`, not a field-level `value`.

**Why the removal rather than a relocation** (ruling B of objectui#3798, confirmed by the maintainer; objectui#3308 is the origin, PR #3793 the safety net that first corrected the misleading `@deprecated` note): the wrapper existed only so the documentation could render a bare field node as a labelled, editable input. No application produces that rendering — on the live path a bare field node has no host for its label or its value. So the field docs, which are a first-hand transcription source for AI authors, were teaching a shape that does not work, and an author copying it got a node with neither label nor `onChange`. Relocating the wrapper into the docs site would have preserved that divergence under a new owner. Hosting the examples in a real form removes the reason for the wrapper to exist: the form renderer already owns label and value state, so the docs can only show what an application actually renders.

The 74 bare-node examples under `examples/schema-catalog/src/schemas/fields-*` are now form-hosted (the other 2 already were). A field's `value` moved to the form's `defaultValues`, because the form renderer spreads react-hook-form's state after the schema props and a field-level `value` is therefore ignored — a catalog guard now pins that so a dead `value` cannot come back.
