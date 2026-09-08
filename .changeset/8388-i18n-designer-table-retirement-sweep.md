---
---

Extend the report-only reverse i18n sweep (`scripts/check-i18n-dead-keys.mjs`) to a
second corpus: the metadata-admin designer's module-local `ENGINE_STRINGS_EN` /
`ENGINE_STRINGS_ZH` table, which both repo-wide i18n gates are blind to by
construction (objectui#8388). Tooling and its tests only — no published package
source changes, so this changeset declares no release.
