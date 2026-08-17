---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
---

The Studio's overlay-layer badge stops printing the producer's raw scope value

objectui#4982. `MetadataLayered.overlayScope` was typed `string | null` under a comment naming its
vocabulary as `organization | environment | package` — three spellings the producer has never
emitted. The real vocabulary lives in `@objectstack/spec`'s `GetMetaItemLayeredResponseSchema`
(`z.enum(['org', 'env']).nullable()`), and the framework's two assignment sites write `'org'` /
`'env'`. Because the declared type was `string`, no compiler anywhere had an opinion, so the wrong
comment was the only description of the field a reader had.

`overlayScope` is now the spec union, derived by indexing the published response type rather than
restated locally (a restatement is the fork `check:spec-symbol-derivation` rejects); the alias ships
as `MetadataOverlayScope`.

User-visible half: `LayeredDiff`'s overlay badge rendered that value straight to screen while the
sibling artifact / none / merged badges all went through `translateConsoleValue`, and
`CONSOLE_VALUE_ZH.layer` had no entry for either value the field can hold. One badge therefore had
two languages depending on the data — a zh-CN admin opening any overlaid metadata item read `org` /
`env`, while an un-overlaid one read 「已设」. The badge now translates like its three siblings, with
「组织」/「环境」 added to the layer table. That table's overlay-scope half is keyed by the spec union,
so a scope the spec adds later fails `type-check` until it has a label instead of quietly reaching a
badge in English. `translateConsoleValue` remains zh-only for every group, as before — extending it
to the other locale packs is a separate decision and not part of this change.
