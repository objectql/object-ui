---
"@object-ui/app-shell": patch
---

fix(packages): Setup's package list and creator agree with the builder on writability

Two disagreements between Setup › Packages and the application builder about the
same package:

- **Display**: `ScopeBadge` defaulted a missing scope to `project`, so writable
  database bases wore the same badge as read-only code packages. Scope-less
  entries now show **可写/Writable** (emerald), `project` reads **只读 · 代码包 /
  Read-only · code** — matching the builder's labeling.
- **Semantics**: the create-package dialog hardcoded `scope: 'project'` onto new
  runtime-created bases, which made the builder's switcher/landing mislabel
  Setup-created packages as read-only. New bases are now created scope-less,
  the same shape the builder's own creator produces.
