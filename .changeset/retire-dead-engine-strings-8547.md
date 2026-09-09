---
---

Internal-only cleanup: dropped four dead `ENGINE_STRINGS` keys
(`engine.directory.allPackages`, `engine.directory.packageFilter`,
`engine.list.allPackages`, `engine.list.packageFilter`) from both the `en` and
`zh` tables in the metadata-admin designer's local label bundle. Each key had no
`t()` call site, no template head, no test and no doc anywhere in the repository
— measured with a lit control on the same command shape. `t()` is not exported
from the package entry, so nothing a consumer of the tarball can reach changes;
no published behaviour changes.
