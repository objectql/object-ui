---
"@object-ui/app-shell": minor
"@object-ui/core": minor
---

Stop offering the retired `action.shortcut` / `action.bulkEnabled` keys.

`@objectstack/spec` 17 retired both as `retiredKey()` tombstones: authoring
either one is a hard PARSE REJECTION, so a draft carrying it cannot be saved
at all. The designer still offered controls for both — a "Bulk — apply to
multiple selected rows" checkbox and a "Shortcut" text field — which meant the
Studio action inspector let an author build a draft the platform would then
refuse, with the rejection arriving later and nowhere near the checkbox.

- **Action inspector**: both controls removed. The keys stay hidden from the
  fallback form (the server's live schema still advertises them, so dropping
  them from the hidden list would put the inputs straight back) — now under a
  `RETIRED_FIELDS` list that says why, so nobody "restores the missing
  control". `bulkEnabled`'s replacement is the list view's `bulkActions` /
  `bulkActionDefs`; `shortcut` has none.
- **Action preview**: the `shortcut` and `bulk` pills are gone — they could
  only ever render for metadata the platform now refuses.
- **`ActionEngine.registerActions`**: no longer harvests the two retired keys
  from authored metadata, which made two dead registration options look
  load-bearing. Both are still accepted on the single-action
  `registerAction(action, options)` overload, where a HOST passes them
  explicitly.
