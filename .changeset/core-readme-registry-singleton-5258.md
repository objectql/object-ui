---
'@object-ui/core': patch
---

Fix `packages/core/README.md`'s Component Registry example, which taught
`new ComponentRegistry()` against an exported singleton **instance**, not a
class — the built `packages/core/dist/registry/Registry.d.ts` declares
`export declare const ComponentRegistry: Registry<any>`, so the snippet did
not compile (`TS2351: This expression is not constructable`, measured by the
objectui#5138 doc-snippet type gate). A reader who copied it got a compile
error; if `new ComponentRegistry()` had compiled it would have produced a
second, empty registry nothing renders from, the more expensive half of the
mistake.

The snippet now calls `ComponentRegistry.register(...)` /
`ComponentRegistry.get(...)` directly on the singleton, with one line stating
it is the process-level shared instance `SchemaRenderer` resolves every
`type` against — the same wording `packages/components/README.md` was given
in objectui#5160, kept consistent across both READMEs. Readers who want their
own isolated registry still have `Registry` itself, separately exported as a
real class.

`scripts/check-doc-snippet-types.mjs`'s `UNGATED_DOCS` entry for
`packages/core/README.md` is updated to match: `TS2351x1` is dropped from its
reason text now that the diagnostic is gone. The entry is not deleted — the
document's remaining `TS2339x2` pair (a different, pre-existing defect) is
out of scope for this change; it's tracked as objectui#5257.
