---
'@object-ui/types': minor
'@object-ui/core': minor
---

`ComponentConfig` now has one authority: `@object-ui/types` declares it, `@object-ui/core` re-exports it

`@object-ui/types` and `@object-ui/core` each published a declaration of
`ComponentConfig`, so an auto-import picked between two different types by
alphabetical order. After the `ComponentMeta` convergence the remaining
difference was genericity and the `component` slot: `@object-ui/types`' was
non-generic with `component: any`, core's was `<T = any>` with
`component: ComponentRenderer<T>`.

`@object-ui/types`' declaration gains that type parameter, **defaulted**, so
every existing spelling keeps its meaning exactly — bare `ComponentConfig` is
`ComponentConfig<any>`, whose `component` is `any`, as before. `@object-ui/core`
re-exports it instead of declaring its own.

The registry-only keys (`tier`, `namespace`, `skipFallback`, `labelling`,
`deprecated`) were not dropped: they moved to a named extension,
`RegistryComponentConfig`, which is what `Registry.getConfig`,
`getAllConfigs` and `getNamespaceComponents` return. Those return values are
type-identical to what they returned before, so every read path is unchanged.

**Breaking:** a consumer that imports `ComponentConfig` from `@object-ui/core`
*and* touches one of those five registry-only keys through that annotation must
switch the annotation to `RegistryComponentConfig` — the name `ComponentConfig`
no longer carries them there. Filed `minor` rather than `major` per AGENTS.md's
versioning policy: objectui's own breaking changes ship as `minor` with the break
spelled out here, because the whole publishable set is one changeset `fixed` group
pinned to `@objectstack`'s major.
