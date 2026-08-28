---
'@object-ui/core': minor
'@object-ui/types': minor
---

`ComponentInput` is now declared once and re-exported, instead of restated in three
places (objectui#4972).

`@object-ui/core`'s `ComponentInput` (`registry/Registry.ts`) and `@object-ui/types`'
plugin-scoped `ComponentInput` (`plugin-scope.ts`, published as `PluginComponentInput`)
were structural copies of the interface in `@object-ui/types`' `base.ts`. Both are now
re-exports of that one declaration, which is the disposition objectui#4580 ruled for the
identical shape — *a structural copy would reproduce the defect the moment either side
moved* — and the way `core/src/types/index.ts` already handles `SchemaNode`.

Either side had already moved. `base.ts` declared thirteen keys; both copies declared
nine, so `min` / `max` / `step` / `placeholder` were missing from **the copy every
component registration actually imports**. Those four keys were unwritable at any real
registration — a plain TypeScript error at the call site — while `ComponentInputSchema`
(the zod schema) and `ComponentMeta.inputs` both accepted them. The publication face
advertised four keys the authoring face rejected. Measured over the repository, no
registration had tried to write one yet, so nothing a user hits was broken today; what
changes is that the four keys become writable, and there is no longer a second
declaration for the next widening to miss.

`ComponentInput`'s arm vocabulary (`ComponentInputControlType`) was already a single
declaration imported by all three sites (objectui#3832); this converges the rest of the
interface.

Measured, not assumed: `@object-ui/core`'s published entry `dist/index.d.ts` is
byte-identical across the change (sha256 `f6494f80…`, both legs). That gauge is reported
here only with its control — a probe that added a *required* key to `ComponentInput` left
the same file byte-identical, because `dist/index.d.ts` is a 63-line barrel of
`export *` lines that names `ComponentInput` zero times. The gauge that can actually fail
is the emitted declaration file: `dist/registry/Registry.d.ts` changes, as does
`@object-ui/types`' `dist/plugin-scope.d.ts`, and those two files are the *only* emitted
declarations that change in either package.

`WidgetInput`'s union-arm capability is deliberately untouched — a different gate path
and a separate judgment.
