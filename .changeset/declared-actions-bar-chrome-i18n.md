---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(app-shell): localize the two `DeclaredActionsBar` strings that bypassed i18n (objectui#2762 P0-3)

The declared action *labels* resolve through `useObjectLabel`, so a zh-CN
workspace got 通过 / 拒绝 buttons — sitting inside a toolbar whose accessible
name was the English literal `'Actions'`, above decision-output fields whose
help text read `Handed to the flow as a decision output.` Both strings are
authored by the bar itself rather than by metadata, and both skipped the locale
bundle entirely.

- `aria-label` now uses the existing `common.actions` key (a host-supplied
  `label` still wins).
- The decision-output help text moves to new `actions.decisionOutput.help` /
  `.helpMultiValue` keys, added across all ten shipped locales.

Worth being precise about why the help text needed fixing at all, since the
runtime *does* localize action params: `useConsoleActionRuntime` runs every
param through `actionParamText`, but these params are synthesized here from the
record's `decision_output_defs`, so their key path (`outputs.<key>`) is dynamic
and no `_actions.<action>.params.*` bundle entry can ever match it. The
fallback is not a rare path — it is the only path, which is why the English
survived.

Not fixed, and deliberately: a decision output that arrives without a `label`
still renders a title-cased version of its machine key. That derived text
mirrors the framework's `humanizeFieldPath` convention, and the real fix is the
backend declaring the label — a client-side bundle cannot key off a dynamic
output name.
