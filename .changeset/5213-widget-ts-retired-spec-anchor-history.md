---
'@object-ui/types': patch
---

`RuntimeWidgetManifest` / `RuntimeWidgetSource` document the spec's retired
`WidgetManifest` / `WidgetSource` as HISTORY, instead of describing them as a
live schema (objectui#5213).

Both JSDoc blocks were written while `@objectstack/spec/ui` still exported a
field-widget-plugin `WidgetManifest` and a `WidgetSource` union — they said the
local types were "renamed off the spec's name", in the present tense, and the
manifest block enumerated the spec shape key by key (`fieldTypes`, `category`,
`lifecycle`, `events`, `properties`, `implementation`, `screenshots`, `license`,
`aria`, `performance`). Protocol 17 retired that entire widget-registration
vocabulary under ADR-0049 enforce-or-remove (objectstack#5055): the installed
`@objectstack/spec` 17.2.0 exports none of those names, and its own tombstone
records why there is nothing to migrate — no schema ever declared a carrier key
of a widget shape, so the record is the D3 `SemanticMigration`
`ui-widget-i18n-family-retired` plus `ui/WidgetManifest` in
`RETIRED_DEFS_BY_MAJOR` for major 17.

A per-key description of a schema that no longer exists is the ADR-0033 failure:
an AI author reads a published docblock as present-tense fact and builds on it.
The enumeration is dropped rather than re-dated, and the blocks now say what is
true today — the bare names are owned by NOBODY, `RuntimeWidgetManifest` is
objectui's only widget-registration contract, and the `Runtime` prefix is kept
BY CHOICE (objectstack#4988's precedent: a freed word is not a reason to spend a
second breaking rename taking it back; the unlock is recorded, not taken, in
objectui#4164). The `inline` collision that made the `WidgetSource` rename
urgent is kept, in the past tense, because it is the reason the prefix exists.
Both blocks now point at the live assertion instead of restating it: the "the
spec no longer owns" rows in
`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`, which are what
goes red if the spec ever re-publishes either name.

Comments only. No type, signature, member or test changed, and the parity test
that owns this fact was already correct — it moved both rows to its "spec no
longer owns" table on the 17.0.0-rc.6 bump.

Declared a `patch` for `@object-ui/types` alone because the emit was measured,
not assumed: both blocks sit on EXPORTED declarations, so they publish. Rebuilt
from a cleared `dist` and `tsconfig.tsbuildinfo` on both sides and compared by
SHA-256 — `dist/widget.d.ts` `bb4f2fd702cac02a…` -> `db1d5fbd53d305f5…`
(a consumer reads this text on hover and in the API docs), while
`dist/widget.js` is byte-identical across the rebuild
(`a3de34c54213a269…` both sides), so nothing runtime moved.
