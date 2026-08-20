---
'@object-ui/collaboration': patch
'@object-ui/permissions': patch
'@object-ui/providers': patch
'@object-ui/fields': patch
'@object-ui/mobile': patch
'@object-ui/auth': patch
---

Publish relative import specifiers with explicit `.js` extensions so these six packages load under plain Node ESM.

Node's ESM resolver does not extension-search relative specifiers and `tsc` never rewrites them, so an extensionless `./Foo` in the source shipped as an extensionless `./Foo` in `dist` and importing the package entry outside a bundler failed with `ERR_MODULE_NOT_FOUND`. Bundled consumers were unaffected. Unbundled consumers — plain Node ESM, an SSR host importing the package directly, anyone running the published tarball without a build step — can now import these entries, and so can the downstream `@object-ui/plugin-*` packages that evaluate through `mobile`, `permissions` and `providers`.
