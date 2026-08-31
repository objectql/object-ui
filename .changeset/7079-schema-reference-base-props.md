---
---

Docs only — the canonical `BaseSchema` "Common Properties" table in
`content/docs/api/schema-reference.md` (objectui#7079). No package source, no
published contract and no runtime behaviour is touched, hence the empty
declaration; `apps/site` is `private: true` and sits in `.changeset/config.json`'s
`ignore` list, so nothing under `content/` ships from this change.

The table narrowed five declared unions to one limb each and omitted five declared
members outright. Measured against `packages/types/src/base.ts` and its Zod mirror
`packages/types/src/zod/base.zod.ts`, whose agreement is held by
`base-schema-zod-mirror-parity.test.ts` reading the mirror's own `.shape`:
`label` and `description` are `string | I18nLabel`, `ariaLabel` is
`string | KeyedI18nLabel` (the KEYED form, not the inline locale map), and both
`visible` and `disabled` take a predicate expression string as well as a boolean —
the expression limb is on the base key itself, not only on the `visibleOn` /
`disabledOn` siblings the paired cells implied. `placeholder`, `style`, `data`,
`bind` and `visibleWhen` had no row at all.

The three combined cells (`visible` / `visibleOn`, `hidden` / `hiddenOn`,
`disabled` / `disabledOn`) are split into one row per member. Packing two members
with different types into a single `boolean` / `string` cell is what made the
error invisible: the pairing reads as a complete, ordered account, and that
appearance of completeness is precisely what hid the third fact. One row per
declared member, in declaration order, makes completeness checkable by reading the
table against the interface.

Nothing in CI reads this table — `check:doc-snippet-types` compiles only `ts` /
`tsx` / `typescript` fences, `check:doc-component-types` judges `type` string
literals and key tables anchored on a `Namespaced key | Bare-name fallback`
header, and no script in the repository parses a Markdown property table.
