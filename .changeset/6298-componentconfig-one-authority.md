---
'@object-ui/types': patch
'@object-ui/core': patch
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
