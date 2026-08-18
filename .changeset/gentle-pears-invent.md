---
'@object-ui/react': patch
'@object-ui/types': patch
'@object-ui/core': patch
'@object-ui/i18n': patch
---

Emit explicit file extensions on relative import specifiers, so the published
entries can be imported by Node's own ESM resolver.

`@object-ui/react`'s built entry re-exported through extensionless relative
specifiers (`export * from './SchemaRenderer'`). Node does not extension-search
relative specifiers, so `import('@object-ui/react')` under plain Node — an SSR
host, or any consumer without a bundler — failed with `ERR_MODULE_NOT_FOUND`.
Bundled consumers were never affected and are unchanged by this.

`@object-ui/types`, `@object-ui/core` and `@object-ui/i18n` carried the same
emission; `@object-ui/react`'s entry stayed unloadable until they were fixed
too, because evaluation crosses into them. No exported API changed.
