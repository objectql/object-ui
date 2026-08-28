---
---

Test-only change — no published behaviour changes.

Adds a component-level test pinning that a `record:quick_actions` action's
declared `resultDialog` reaches the ambient `<ActionProvider>`'s shared
`ActionRunner` and opens the reveal dialog with the response value (success
toast suppressed), plus the negative leg — with no provider, the response is
silently discarded and the documented `console.warn` fires. Closes the gap
found while implementing objectstack#10681 (objectui#5711).
