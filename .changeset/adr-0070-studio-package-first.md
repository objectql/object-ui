---
"@object-ui/app-shell": patch
---

feat(studio): package-first create flow — prompt or redirect to a writable base (ADR-0070 D3)

Studio's create entry points no longer let a new metadata item land in a code
package or the package-less "Local / Custom" bucket. ResourceListPage's create
gate (`handleCreate`) now: opens the create-base dialog when no writable base
exists; redirects into the first base when the active scope is Local/none but
bases exist; otherwise proceeds normally. Adds package-scope helpers
(`isLocalScope` / `writableBaseOptions`) with tests, surfaces the kernel's
`writable_package_required` (422) as an actionable error in ResourceEditPage,
and exports `CreatePackageDialog` from PackagesPage for reuse.
