---
"@object-ui/app-shell": patch
---

fix(flow-runner): honor a screen field's `visibleWhen` — in rendering AND in required-enforcement (framework#3528)

A paused screen-flow rendered every declared field regardless of its
`visibleWhen` predicate, while still enforcing `required` over the full list.
Where a field is optional-by-design but required *when shown*, that combination
dead-ends the run: Submit blocks on an input the user was never shown, issues
**zero network requests**, and the flow sits paused forever.

Reproduced in Chromium against a real HotCRM dev server — on both the console
shipped with `@objectstack/*` 16.1.0 and current `main`:

```
→ POST /api/v1/automation/lead_conversion/trigger   200 {status: paused, screen}
   rendered: ["Create Opportunity? *", "Opportunity Name *", "Opportunity Amount"]
   click Submit (checkbox untouched)
→ (nothing)   resume calls: 0   toasts: none   dialog: still open
```

The predicate never reached the client — the framework declared `visibleWhen` on
the screen node's designer form but dropped it when building the paused payload
(fixed in objectstack#3771). This is the consumer half.

- **`visibleScreenFields(screen, values)`** is the single source of truth for
  what is on screen. `ScreenView` renders from it and `FlowRunner.submit()`
  validates from it, so the two can never disagree — splitting them is the bug.
- Predicates are **bare CEL over the screen's own field names**
  (`createOpportunity == true`), evaluated through the canonical
  `@objectstack/formula` engine, the same verdict the server reaches for field
  rules. Values bind both bare and under `record.`.
- **Declared fields are seeded before evaluation.** An untouched checkbox holds
  `undefined`, which CEL treats as an unknown identifier — the evaluation errors
  and falls open, leaving the dependent field on screen in exactly the state
  where it should be hidden. Booleans seed `false`, everything else `null`.
- **Fail-open is preserved for genuinely broken predicates** (syntax error, or a
  name that is not a field on this screen), matching `resolveFieldRuleState`:
  hiding an input on a typo would silently drop data the flow is waiting for.

Screens with no `visibleWhen` behave exactly as before.
