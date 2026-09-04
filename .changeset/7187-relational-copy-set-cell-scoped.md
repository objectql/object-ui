---
---

Scope `ObjectGrid`'s relational copy-set derivation to the consumer the copied bag actually
reaches (objectui#7187). No published behaviour changes: the copy set is byte-identical
before and after — the same seven keys, in the same order.

The gate in `packages/plugin-grid/src/__tests__/relationalMetaCopySet.derivation.test.ts`
re-extracted a read set from three consumers and collapsed it into a UNION. Only one of the
three, `LookupCellRenderer`, is handed the bag `applyRelationalMeta` writes; the two inline
editor widgets are fed `{ name, ...fieldDef }` straight off the object schema. So membership
in that union meant "some consumer reads this key" and never "this bag is how that consumer
gets it" — and a copy-set entry asserts the second. The union was read as the first claim's
evidence for the second twice, and both verdicts shipped: objectui#6875 put `descriptionField`
and `lookupColumns` on the copy set on it, and objectui#7166 had to take them back off.

Three changes make that mistake unavailable:

- The reader axis is now recorded PER CONSUMER on every entry (`readers`), and the gate checks
  each declared list against that consumer's own source in both directions — a hand-widened
  declaration is an orphan, a new spelling in a chain is unclassified, and both are red.
- The copy set is derived from `CONSUMERS_FED_THIS_BAG` — the cell alone. The one deliberate
  exception, the three snake_case spellings kept on an unanswered producer-side question, has
  to name itself per key (`copiedWithoutCellReader`), and the gate confines that exit to keys
  `FieldSchema` does not declare, so no authorable key can take it.
- The `deferred` verdict is gone. It meant "read only by an editor widget", which is now
  measured rather than declared; its seven keys are `spec` (which is what they are) and stay
  off the copy set because no consumer fed the bag reads them.

Consequence worth stating: the hand-written non-membership pin that had been holding
objectui#7166's retirement on its own is now redundant as a guard — re-adding any of the three
retired keys turns the gate red on a derived assertion under every available verdict. The pin
is kept so a regression is reported by name, not because it is the only hold.
