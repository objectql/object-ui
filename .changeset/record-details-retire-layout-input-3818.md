---
'@object-ui/plugin-detail': patch
---

`record:details` stops publishing a `layout` key the spec removed and the renderer never honoured

`record:details` declared `layout: enum ['auto','custom']` with `defaultValue: 'auto'` and the description "auto uses the object highlightFields; custom uses explicit sections". None of that was ever implemented. The renderer's only `schema.layout` read tested `'inline'` | `'compact'` — two values the schema never permitted — so both legal values fell through the same ternary and the key selected nothing. `auto` and `custom` have behaved identically for as long as both have existed.

Two directions were wrong with zero diagnostics: `layout: 'auto'` plus explicit `sections` still rendered the sections, and `layout: 'custom'` with no sections silently fell back to the flat body rather than reporting the missing groups. Because the input carried a `defaultValue`, this was not stale documentation — it was the manifest, the generated `sdui-intrinsics.d.ts` and the designer panel actively offering the key. An AI author writing `layout: 'custom'` believed it took effect.

`@objectstack/spec` 17.0.0 removed the property (objectstack#6946, ADR-0087 D2); `17.0.0-rc.6` is pinned here, so the key is already rejected on parse with a named migration message pointing at `os migrate meta --from 16`. This release completes the objectui half of that retirement: the input declaration is gone, and so is the dead `inline`/`compact` branch — the synthesized layout is now the constant it always resolved to.

Nothing that worked stops working. The body-source contract is unchanged and is now the only one declared: **`sections` renders the explicit groups; omitting it falls back to the flat body derived from the object's fields.** That is pinned in both directions, plus the empty-array boundary between them, in `recordDetailsBodySource.test.tsx`.

One gate got sharper on the way through. The parity test's "declares no top-level input the spec does not accept" check read raw `.shape` keys — but an ADR-0087 D2 tombstone stays *in* the shape as a `z.never()`, so a retired key still answers "is this declared?" with yes. That is precisely why this input survived the rc.6 pin bump with every derived gate green. The check now filters tombstoned members out, so it catches the next D2 retirement instead of waving it through.
