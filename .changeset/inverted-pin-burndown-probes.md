---
"@object-ui/types": patch
---

Fix the admission probes behind objectstack#4171's three inverted pins, and
derive the `NavigationItem` keys that genuinely became derivable (objectui#3177).

Spec 17.0.0-rc.1 typed `NavigationItem`, `FormField` and
`ConditionalValidation.then`/`.otherwise`, so the `IsAny` / `IsUnknown` pins
guarding them fired. Firing was supposed to mean "the burn-down is due". A
per-symbol triage found it did not: **`any` was never the only blocker for any
of the three**, so "no longer `any`" was never the right admission question.
Nothing was bound; the probes now ask the condition that actually governs each
symbol, and each still asserts today's state — so they pass now and stop
compiling the day their own blocker lifts.

- `NavigationItem` — the spec models navigation as a nine-variant discriminated
  union; objectui keeps one flat shape, and the spec has no counterpart at
  either tier for `visible: boolean` (which `menuItemToNavigationItem`
  manufactures when it inverts legacy `MenuItem.hidden`), `pinned` (backs
  `useNavPins`), the legacy `defaultOpen` spelling, or a separator carrying a
  `label`. Four probes, one per blocker.
- `FormField` — two concepts on two layers, not two dialects of one: the
  required keys are disjoint (objectui `name` = the form data path; spec
  `field` = an object-field reference, with no `name` at either tier), and the
  shared `field` key is a string on one side and the resolved metadata object
  on the other. Binding would also collapse the objectui#3090 disambiguation
  that exports `SpecFormField` separately, and revert framework#4074's
  `dependsOn` widening.
- `ConditionalValidation` — the branches went from `unknown` to
  `BaseValidationRuleShape`, which is `{ type: string; …; [key: string]:
  unknown }`. Better than `unknown`, still not derivable: `type` is not a
  literal union so a branch cannot narrow by discriminant, and the index
  signature waves through any member — a typo'd `type: 'formatt'` included. The
  spec says so itself and names the remaining work as objectstack#4075. The
  probe now pins "literal discriminant / no index signature", so it goes green
  exactly when that lands.

What DID become derivable is derived. `NavigationItemType` now comes off the
spec's own nav-item discriminant instead of a hand-written nine-member copy —
the objectstack#4115 failure class, and it also makes a future spec variant a
compile error at exhaustive consumers rather than a silent `default:`. Same for
`recordMode`, `filters`, `badge`, `target`, `params` and `actionDef`, each taken
from the spec branch that owns it, extending the existing `badgeVariant`
precedent. No member changes today, so no consumer is affected.
