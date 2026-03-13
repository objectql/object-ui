---
"object-ui": patch
---

Bug fixes and dependency upgrades

- fix: filter `id` field from RelatedList auto-generated columns
- fix: resolve TS2742 in drawer.tsx and sidebar.tsx for portable declaration files
- fix: replace OData string filters with object format in dataSource.find calls
- chore(deps): upgrade @objectstack/* from ^3.2.5 to ^3.2.6
- refactor: unify primary key field from `_id` to `id` per objectstack-ai/spec
- refactor: unify i18n service registration across server/dev/mock environments
- refactor: auth client to use official better-auth createAuthClient
- feat(components): migrate to unified radix-ui package + shadcn v4 RTL classes
