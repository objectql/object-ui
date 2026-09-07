---
'@object-ui/types': minor
'@object-ui/sdui-parser': minor
'@object-ui/core': patch
---

`binding` on a component input is framework-set, not author-declared: `@object-ui/types` gains `InjectedComponentInput`, the `'field'` binding arm is retired from `@object-ui/sdui-parser`'s `RegistryConfigLike`, and the `as ComponentMeta` cast at the injection seam in `@object-ui/core` is gone (objectui#6950; maintainer ruling of 2026-09-07, director decision batch #69; ADR-0049 enforce-or-remove).

**What was measured.** `binding` was published — the manifest serializer forwards it — and read — `validateTree` records a binding site for it — while `ComponentInput`, the authoring type every registration writes against, did not declare it. The one writer in the tree, `ELEMENT_DATA_SOURCE_INPUT`, therefore carried a hand-written inline type and reached a registration's `inputs` through `as ComponentMeta` in `Registry.register`. Declared narrower than enforced, on a published type — and `ComponentInput`'s own docblock listed `binding` among the forwarded per-input keys.

**The ruling** answered the product question the card asked — may an ordinary registration declare a binding input? — with no. So:

- **`@object-ui/types`** exports `InjectedComponentInput`, an `interface … extends ComponentInput` with the required marker `binding: 'object'`. `ComponentInput` itself does not change: no member is added, and authoring `binding` on a registration stays an excess-property `tsc` error — now on purpose and documented at the interface. The two tombstone docblocks that listed `binding` as a forwarded key now say it is forwarded from the framework's injected input, not authored.
- **`@object-ui/core`** types `ELEMENT_DATA_SOURCE_INPUT` as `InjectedComponentInput` and splices it through a typed local; the cast is gone. Runtime behaviour is unchanged — the same key, `type`, `binding` and `description` reach the manifest, and `validateTree` still records the binding site.
- **`@object-ui/sdui-parser`** narrows `RegistryConfigLike.inputs[].binding` from `'object' | 'field'` to `'object'`. The `'field'` arm had zero writers — every `binding:` literal in `packages/`, `apps/` and `examples/` is `'object'`, 7 of 7 at this change's merge-base — and nothing on either side of the manifest resolved a field binding. **Breaking, deliberately:** a config that feeds `manifestFromConfigs` a `binding: 'field'` input is now a type error instead of a manifest entry the server would never resolve. `ManifestInput.binding`, the manifest reader's vocabulary, is not narrowed by this change.

If a real need for author-declared bindings is ever measured, it is filed as a widening of `ComponentInput` with the vocabulary decided then — not by putting the cast back.
