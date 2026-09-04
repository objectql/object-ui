---
'@object-ui/cli': minor
---

`objectui validate` now prints the failing union arm the document selected, instead of a
bare "Invalid input" (objectui#7004, maintainer ruling 2026-09-02 — option B).

`safeValidateSchema` checks a document against `AnyComponentSchema`, a `z.union`. When a
document matches no arm, Zod reports ONE top-level issue — `invalid_union` · `Invalid
input` · path `(root)` — and hangs every arm's real diagnosis off that issue's `errors`
array, which nothing read. So a menu whose item used the divider spelling retired in
objectui#6523 printed a bare verdict on the whole document, while the remediation text
objectui#6931 wrote into that arm sat one level down, unreachable.

**What is printed now.** When the top-level issue is a failing union:

- the document's `type` selects exactly one arm ⇒ that arm's issues are printed beneath
  the entry as `1.1`, `1.2` … with their real paths (`Path: items → 0 → type`) and codes,
  and **nothing** from the other arms;
- no arm accepts the `type` ⇒ `No arm accepts type "dropdwn-menu".` plus the nearest few
  of the accepted values, ranked by edit distance and **capped** at five
  (`MAX_UNION_ARMS_REPORTED`);
- the document declares no `type` at all ⇒ the note says so and offers no candidates —
  "nearest" needs something to be near, and an alphabetical slice of 108 arm names
  presented as guidance would be a bogus suggestion;
- a union with no `type` discriminator to select on — `MenuItemSchema`, whose two arms
  both declare `type` as an ADR-0049 retirement tombstone — reports every arm, labelled
  and capped by the same constant. This is the path that finally delivers the
  objectui#6523 text to the author.

Printing EVERY arm was rejected in the ruling: `AnyComponentSchema` resolves to 108 leaf
arms, so one mistyped `type` would have produced hundreds of lines.

`objectui check` is unchanged and deliberately so: it has no zod-issue printer, using
`safeValidateSchema(...).success` as a boolean recogniser. Printing issues behind a
*negative* recognition would flood its report with diagnoses of non-ObjectUI files, the
failure objectui#5127 and objectui#6075 exist to prevent.

Nothing about which documents are ACCEPTED changes — this is diagnostic output only.
