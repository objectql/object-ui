---
'@object-ui/app-shell': patch
---

Flow builder data-picker (#1934): inline validation now also shows on the repeater surfaces that carry the picker — decision **Branches** expressions, screen field **"visible when"**, and key/value **values** — not just single fields. Each shows the ADR-0032 brace error (red) or a scope-aware "unknown reference" warning (amber) via a shared `FlowExprIssue` line. The trigger-record picker also offers `previous.<field>` references on update / change / before-update triggers.
